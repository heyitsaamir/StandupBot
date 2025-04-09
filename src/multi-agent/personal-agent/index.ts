import 'dotenv/config';
import { App } from '@microsoft/spark.apps';
import { DevtoolsPlugin } from "@microsoft/spark.dev";

// Initialize the Spark application
const app = new App({  
    plugins: [new DevtoolsPlugin()],
});

// Handle incoming messages
app.on('message', 
    async ({ send, activity }) => {
  // Check if it's a message activity (type guard)
  if (activity.text) {
    console.log(`Personal Agent received message: ${activity.text}`);
    await send(
        "Hi.  Got your message: " + activity.text
      );
    }
});

// Get port from environment variable or default to 3011
const port = process.env.PERSONAL_AGENT_PORT || 3011;

// Start the server using app.start() within an async IIFE
(async () => {
  try {
    await app.start(port);
    console.log(`[personal-agent] Server started listening on port ${port}`);
  } catch (err: any) { 
    console.error(`[personal-agent] Error starting server: ${err}`);
    process.exit(1); 
  }
})();
