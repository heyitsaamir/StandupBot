import { App } from "@microsoft/spark.apps";
import { DevtoolsPlugin } from "@microsoft/spark.dev";
import { handleCardAction } from "./handlers/cardActions";
import { handleDialogOpen, handleDialogSubmit } from "./handlers/dialog";
import { handleMessage } from "./handlers/message";
import { ensureStandupInitialized } from "./utils/initializeStandup";

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

// Handle incoming messages
app.on(
  "message",
  async ({ send, activity, isSignedIn, signin, signout, api }) => {
    console.log("Received message:", activity);
    const standup = await ensureStandupInitialized({ send });
    if (!standup) {
      console.log("Standup not initialized");
      return;
    }

    await handleMessage(
      activity,
      {
        send,
        signin,
        api,
        signout,
        isSignedIn,
        app,
      },
      standup
    );
  }
);

// Handle dialog events
app.on("dialog.open", async ({ activity, send }) => {
  const standup = await ensureStandupInitialized({
    send,
  });
  if (!standup) return;
  return handleDialogOpen(activity, standup);
});

app.on("dialog.submit", async ({ activity, send }) => {
  const standup = await ensureStandupInitialized({ send });
  if (!standup) return;

  const response = await handleDialogSubmit(activity, send, standup);
  return {
    status: response?.status || 200,
    body: {
      task: {
        type: "message",
        value: response?.body?.task?.value || "",
      },
    },
  };
});

// Handle card actions
app.on("card.action", async ({ activity, send, api }) => {
  const standup = await ensureStandupInitialized({ send });
  if (!standup) return;

  const response = await handleCardAction(activity, send, api, standup);
  return {
    statusCode: 200,
    type: "application/vnd.microsoft.activity.message",
    value: response?.value || "",
  };
});

// Handle installation
app.on("install.add", async ({ send }) => {
  await send("Yo yo whassap? I'm a standup bot. I help you conduct standups.");
});

// Handle sign in
app.event("signin", async ({ send }) => {
  await send("You are signed in!");
});

(async () => {
  await app.start(+(process.env.PORT || 3000));
})();
