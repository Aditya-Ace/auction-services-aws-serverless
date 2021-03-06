import AWS from "aws-sdk";
import commonMiddleware from "../lib/commonMiddleware";
import createError from "http-errors";
import validator from "@middy/validator";
import { getAuctionById } from "./getAuction";
import placeBidSchema from "../lib/schemas/placeBidSchema";

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function placeBid(event, context) {
  const { id } = event.pathParameters;
  const { amount } = event.body;
  const auction = await getAuctionById(id);

  if (auction.status !== "OPEN")
    throw new createError.Forbidden("You cannot bid on the closed auctions!");

  if (amount <= auction.highestBid.amount)
    throw new createError.Forbidden(
      `Your bid must be higher than the last bid of ${auction.highestBid.amount}`
    );

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: "set highestBid.amount = :amount",
    ExpressionAttributeValues: {
      ":amount": amount,
    },
    ReturnValues: "ALL_NEW",
  };

  let updatedAuction;
  try {
    const response = await dynamodb.update(params).promise();
    updatedAuction = response.Attributes;
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }
  if (!updatedAuction) {
    throw new createError.NotFound(
      `Auction with the given id# ${id} not found.`
    );
  }
  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

export const handler = commonMiddleware(placeBid).use(
  validator({ inputSchema: placeBidSchema })
);
