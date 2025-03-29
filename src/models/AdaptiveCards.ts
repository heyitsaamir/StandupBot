import {
  ExecuteAction,
  ICard,
  SubmitAction,
  TaskFetchAction,
  TaskFetchData,
} from "@microsoft/spark.cards";
import { User } from "./StandupGroup";

export function createStandupCard(): ICard {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "Standup Session",
        size: "large",
        weight: "bolder",
      },
      {
        type: "TextBlock",
        text: "Click your name to enter your standup update:",
        wrap: true,
      },
      {
        type: "ActionSet",
        actions: [
          new TaskFetchAction({})
            .withTitle("Fill out your status")
            .withData(new TaskFetchData("standup_input"))
            .withStyle("positive"),
          new ExecuteAction({
            title: "Close standup",
          })
            .withStyle("default")
            .withData({ action: "close_standup" }),
        ],
      },
    ],
  };
}

export function createTaskModule(user: User): ICard {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: `${user.name}'s Standup Update`,
        size: "large",
        weight: "bolder",
      },
      {
        type: "Input.Text",
        id: "standupResponse",
        placeholder: "Enter your standup update...",
        isMultiline: true,
        isRequired: true,
        style: "text",
      },
      {
        type: "Input.Text",
        id: "parkingLot",
        placeholder: "Anything you want to discuss as a team?",
        isMultiline: true,
        style: "text",
      },
      {
        type: "ActionSet",
        actions: [
          new SubmitAction({
            title: "Submit",
          }).withData({
            action: "submit_standup",
            userId: user.id,
          }),
        ],
      },
    ],
  };
}
