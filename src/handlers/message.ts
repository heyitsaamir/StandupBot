import { ChatPrompt } from "@microsoft/spark.ai";
import { MentionEntity } from "@microsoft/spark.api";
import { OpenAIChatModel } from "@microsoft/spark.openai";
import { executeRegister } from "../commands/register";
import { executeCloseStandup, executeStartStandup } from "../commands/standup";
import { CommandContext } from "../commands/types";
import {
  executeAddUsers,
  executeGroupDetails,
  executeRemoveUsers,
} from "../commands/users";
import { Standup } from "../models/Standup";

// Initialize ChatPrompt once for natural language commands
const nlpPrompt = new ChatPrompt({
  instructions:
    "You are a standup bot assistant that understands natural language commands.",
  model: new OpenAIChatModel({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
  }),
});

export async function handleMessage(
  activity: any,
  send: (message: any) => Promise<any>,
  isSignedIn: boolean,
  signin: () => Promise<any>,
  api: any,
  standup: Standup
) {
  if (activity.text == null) {
    return;
  }

  // if (!isSignedIn) {
  //   await send("Please sign in to use this bot.");
  //   await signin();
  //   return;
  // }

  const mentions = activity.entities
    ?.filter((e: any): e is MentionEntity => {
      return e.type === "mention" && e.mentioned.role !== "bot";
    })
    .map((mention: MentionEntity) => ({
      id: mention.mentioned?.id || "",
      name: mention.mentioned?.name || "",
    }));

  const context: CommandContext = {
    send,
    conversationId: activity.conversation.id,
    userId: activity.from.id,
    userName: activity.from.name,
    api,
    mentions: mentions || [],
  };

  const text = activity.text.toLowerCase().trim();

  if (text.startsWith("!")) {
    // Handle direct commands with existing string matching
    if (text.includes("!register")) {
      await executeRegister(context, standup, text);
      return;
    }

    if (text.includes("!add")) {
      await executeAddUsers(context, standup);
      return;
    }

    if (text.startsWith("!remove")) {
      await executeRemoveUsers(context, standup);
      return;
    }

    if (text.includes("group details")) {
      await executeGroupDetails(context, standup);
      return;
    }

    if (text.includes("restart standup")) {
      await executeStartStandup(context, standup, true);
      return;
    }

    if (text.includes("start standup")) {
      await executeStartStandup(context, standup);
      return;
    }

    if (text.includes("close standup")) {
      await executeCloseStandup(context, standup);
      return;
    }
    return;
  }

  try {
    // Register functions for natural language command interpretation
    nlpPrompt.function(
      "register",
      "Register a new standup group",
      async () => await executeRegister(context, standup, text)
    );

    nlpPrompt.function(
      "add",
      "Add users to the standup group",
      async () => await executeAddUsers(context, standup)
    );

    nlpPrompt.function(
      "remove",
      "Remove users from the standup group",
      async () => await executeRemoveUsers(context, standup)
    );

    nlpPrompt.function(
      "groupDetails",
      "Show standup group information",
      async () => await executeGroupDetails(context, standup)
    );

    nlpPrompt.function(
      "startStandup",
      "Start a new standup session",
      async () => await executeStartStandup(context, standup)
    );

    nlpPrompt.function(
      "restartStandup",
      "Restart the current standup session",
      async () => await executeStartStandup(context, standup, true)
    );

    nlpPrompt.function(
      "closeStandup",
      "End the current standup session",
      async () => await executeCloseStandup(context, standup)
    );

    nlpPrompt.function(
      "purpose",
      "Explain the purpose of the bot",
      async () => {
        return `I can help you conduct standups by managing your standup group, adding or removing users, and starting or closing standup sessions.`;
      }
    );

    await nlpPrompt.send(text); // Let ChatPrompt decide which function to call based on the message
  } catch (error) {
    console.error("Error processing natural language command:", error);
    await send(
      "I couldn't understand that command. Try using ! prefix for direct commands."
    );
  }
}
