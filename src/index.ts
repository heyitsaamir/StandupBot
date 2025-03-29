import { cardAttachment, TaskModuleResponse } from "@microsoft/spark.api";
import { App } from "@microsoft/spark.apps";
import { DevtoolsPlugin } from "@microsoft/spark.dev";
import { createStandupCard, createTaskModule } from "./models/AdaptiveCards";
import { Standup } from "./models/Standup";
import { StandupResponse } from "./models/StandupGroup";

const standup = new Standup();
const app = new App({
  plugins: [new DevtoolsPlugin()],
});

app.on("message", async ({ send, activity, isSignedIn, signin }) => {
  if (!isSignedIn) {
    await send("Please sign in to use this bot.");
    await signin();
    return;
  }

  const text = activity.text.toLowerCase().trim();
  const conversationId = activity.conversation.id;

  // Handle registration
  if (text.startsWith("!register")) {
    const oneNoteLink = text.split(" ")[1];
    const result = await standup.registerGroup(conversationId, oneNoteLink, {
      id: activity.from.id,
      name: activity.from.name,
    });

    switch (result.type) {
      case "success":
        await send(result.data.message);
        break;
      case "error":
        await send(result.message);
        break;
    }
    return;
  }

  // Handle user management
  if (text.startsWith("!add")) {
    const mentions = activity.entities?.filter((e) => e.type === "mention");
    if (!mentions?.length) {
      await send("Please @mention the users you want to add.");
      return;
    }

    const users = mentions.map((mention) => ({
      id: mention.mentioned?.id || "",
      name: mention.mentioned?.name || "",
    }));

    const result = await standup.addUsers(conversationId, users);
    switch (result.type) {
      case "success":
        await send(result.data.message);
        break;
      case "error":
        await send(result.message);
        break;
    }
    return;
  }

  if (text.startsWith("!remove")) {
    const mentions = activity.entities?.filter((e) => e.type === "mention");
    if (!mentions?.length) {
      await send("Please @mention the users you want to remove.");
      return;
    }

    const userIds = mentions.map((mention) => mention.mentioned?.id || "");
    const result = await standup.removeUsers(conversationId, userIds);
    switch (result.type) {
      case "success":
        await send(result.data.message);
        break;
      case "error":
        await send(result.message);
        break;
    }
    return;
  }

  // Handle standup
  if (text === "start standup") {
    const result = await standup.startStandup(conversationId);
    switch (result.type) {
      case "success":
        await send({
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: createStandupCard(),
            },
          ],
        });
        break;
      case "error":
        await send(result.message);
        break;
    }
    return;
  }
});

// Handle task module opening
app.on("dialog.open", async ({ activity }) => {
  // const data = activity.value.data; // TODO: Figure out how this works lol. Data is null
  // if (data.action === "standup_input") {
  const taskModuleResponse: TaskModuleResponse = {
    task: {
      type: "continue",
      value: {
        width: 400,
        height: 400,
        title: "Standup Input",
        card: cardAttachment(
          "adaptive",
          createTaskModule({
            id: activity.from.id,
            name: activity.from.name,
          })
        ),
      },
    },
  };
  return {
    status: 200,
    body: taskModuleResponse,
  };
  // }
});

app.on("dialog.submit", async ({ activity }) => {
  const conversationId = activity.conversation.id;
  const data = activity.value.data;

  const standupResponse: StandupResponse = {
    userId: activity.from.id,
    response: data.standupResponse,
    parkingLot: data.parkingLot,
    timestamp: new Date(),
  };

  const result = await standup.submitResponse(conversationId, standupResponse);
  switch (result.type) {
    case "success":
      return {
        status: 200,
        body: {
          task: {
            type: "message",
            value: result.data.message,
          },
        },
      };
    case "error":
      return {
        status: 200,
        body: {
          task: {
            type: "message",
            value: result.message,
          },
        },
      };
  }
});

// Handle card actions
app.on("card.action", async ({ activity, send }) => {
  const conversationId = activity.conversation.id;
  const data = activity.value?.action?.data;

  if (!data) {
    return {
      statusCode: 200,
      type: "application/vnd.microsoft.activity.message",
      value: "No data provided.",
    };
  }

  if (data.action === "submit_standup") {
    const standupResponse: StandupResponse = {
      userId: data.userId,
      response: data.standupResponse,
      timestamp: new Date(),
    };

    const result = await standup.submitResponse(
      conversationId,
      standupResponse
    );
    switch (result.type) {
      case "success":
        await send(result.data.message);
        return {
          statusCode: 200,
          type: "application/vnd.microsoft.activity.message",
          value: result.data.message,
        };
      case "error":
        await send(result.message);
        return {
          statusCode: 200,
          type: "application/vnd.microsoft.activity.message",
          value: result.message,
        };
    }
  }

  if (data.action === "close_standup") {
    const result = await standup.closeStandup(conversationId);
    switch (result.type) {
      case "success":
        if (result.data.summary) {
          await send(result.data.summary);
        }
        return {
          statusCode: 200,
          type: "application/vnd.microsoft.activity.message",
          value: result.data.message,
        };
      case "error":
        await send(result.message);
        return {
          statusCode: 200,
          type: "application/vnd.microsoft.activity.message",
          value: result.message,
        };
    }
  }
});

app.event("signin", async ({ send }) => {
  await send("You are signed in!");
});

(async () => {
  await app.start(+(process.env.PORT || 3000));
})();
