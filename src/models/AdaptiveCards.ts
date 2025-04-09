import {
  ExecuteAction,
  ICard,
  SubmitAction,
  TaskFetchAction,
  TaskFetchData,
} from "@microsoft/spark.cards";
import { StandupResponse, User } from "./types";

export function createStandupCard(
  completedResponses: string[] = [],
  previousParkingLot?: string[]
): ICard {
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
        text: "Enter your details by clicking the button below.",
        wrap: true,
      },
      ...(completedResponses.length > 0
        ? [
            {
              type: "TextBlock" as const,
              text: `Completed responses: ${completedResponses.join(", ")}`,
              wrap: true,
              spacing: "medium" as const,
            },
          ]
        : []),
      ...(previousParkingLot && previousParkingLot.length > 0
        ? [
            {
              type: "TextBlock" as const,
              text: "Previous Parking Lot Items:",
              wrap: true,
              spacing: "medium" as const,
            },
            {
              type: "TextBlock" as const,
              text: previousParkingLot.map((item) => `• ${item}`).join("\n"),
              wrap: true,
              spacing: "small" as const,
            },
          ]
        : []),
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

export function createPageSelectionCard(
  pages: { id: string; title: string }[],
  sourceConversationId: string
): ICard {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "Select OneNote Page for Standup",
        size: "large",
        weight: "bolder",
      },
      {
        type: "TextBlock",
        text: "Choose a page to store your standup notes:",
        wrap: true,
      },
      {
        type: "Input.ChoiceSet",
        id: "pageId",
        style: "expanded",
        isRequired: true,
        choices: pages.map((page) => ({
          title: page.title,
          value: page.id,
        })),
      },
      {
        type: "ActionSet",
        actions: [
          new ExecuteAction({
            title: "Register",
          }).withData({
            action: "register_standup",
            sourceConversationId: sourceConversationId,
          }),
        ],
      },
    ],
  };
}

export function createTaskModule(
  user: User,
  existingResponse?: StandupResponse
): ICard {
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
        type: "TextBlock",
        text: "What did you do since last standup?",
        wrap: true,
      },
      {
        type: "Input.Text",
        id: "completedWork",
        placeholder: "Enter your completed tasks and progress...",
        isMultiline: true,
        isRequired: true,
        style: "text",
        value: existingResponse?.completedWork,
      },
      {
        type: "TextBlock",
        text: "What do you plan to do today?",
        wrap: true,
      },
      {
        type: "Input.Text",
        id: "plannedWork",
        placeholder: "Enter your planned tasks for today...",
        isMultiline: true,
        isRequired: true,
        style: "text",
        value: existingResponse?.plannedWork,
      },
      {
        type: "TextBlock",
        text: "Parking Lot",
        wrap: true,
      },
      {
        type: "Input.Text",
        id: "parkingLot",
        placeholder: "Anything you want to discuss as a team?",
        isMultiline: true,
        style: "text",
        value: existingResponse?.parkingLot,
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
