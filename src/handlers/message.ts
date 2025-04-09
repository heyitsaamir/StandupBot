import { ChatPrompt } from "@microsoft/spark.ai";
import { IMessageActivity, MentionEntity } from "@microsoft/spark.api";
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

export async function handleMessage(
  activity: IMessageActivity,
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

  // Initialize ChatPrompt once for natural language commands
  const nlpPrompt = new ChatPrompt({
    instructions:
      "You are a standup bot assistant that understands natural language commands. Use the tools available to you to figure out what the user wants to do.",
    model: new OpenAIChatModel({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
    }),
  });

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
    tenantId: activity.conversation.tenantId || "unknown",
  };

  const text = activity.text.toLowerCase().trim();

  if (text.startsWith("!")) {
    console.log("Exact command detected ", text);
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

  console.log("Natural language command detected ", text);
  let fnExecuted: string | null = null;
  try {
    // Register functions for natural language command interpretation
    nlpPrompt.function("register", "Register a new standup group", async () => {
      fnExecuted = "register";
      await executeRegister(context, standup, text);
    });

    nlpPrompt.function("add", "Add users to the standup group", async () => {
      fnExecuted = "add";
      console.log("Adding users to the standup group");
      await executeAddUsers(context, standup);
    });

    nlpPrompt.function(
      "remove",
      "Remove users from the standup group",
      async () => {
        fnExecuted = "remove";
        console.log("Removing users from the standup group");
        await executeRemoveUsers(context, standup);
      }
    );

    nlpPrompt.function(
      "groupDetails",
      "Show standup group information",
      async () => {
        fnExecuted = "groupDetails";
        console.log("Showing standup group information");
        await executeGroupDetails(context, standup);
      }
    );

    nlpPrompt.function(
      "startStandup",
      "Start a new standup session",
      async () => {
        fnExecuted = "startStandup";
        console.log("Starting a new standup session");
        await executeStartStandup(context, standup);
      }
    );

    nlpPrompt.function(
      "restartStandup",
      "Restart the current standup session",
      async () => {
        fnExecuted = "restartStandup";
        console.log("Restarting the current standup session");
        await executeStartStandup(context, standup, true);
      }
    );

    nlpPrompt.function(
      "closeStandup",
      "End the current standup session",
      async () => {
        fnExecuted = "closeStandup";
        console.log("Ending the current standup session");
        await executeCloseStandup(context, standup);
      }
    );

    nlpPrompt.function(
      "purpose",
      "Explain the purpose of the bot",
      async () => {
        console.log("Explaining the purpose of the bot");
        return `I can help you conduct standups by managing your standup group, adding or removing users, and starting or closing standup sessions.`;
      }
    );

    const result = await nlpPrompt.send(text);
    console.log("Result of the natural language command", result);
    if (fnExecuted == null) {
      console.log("Sending the result of the natural language command");
      await send(result.content);
    } else {
      console.log("Did not send the result of the natural language command");
    }
  } catch (error) {
    console.error("Error processing natural language command:", error);
    await send(
      "I couldn't understand that command. Try using ! prefix for direct commands."
    );
  }
}
