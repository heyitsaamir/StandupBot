import { Standup } from "../models/Standup";

let standupInstance: Standup | null = null;

export async function ensureStandupInitialized({
  send,
}: {
  send: (message: any) => Promise<any>;
}): Promise<Standup | null> {
  if (!standupInstance) {
    const cosmosConnectionString = process.env.COSMOS_CONNECTION_STRING;
    if (!cosmosConnectionString) {
      await send(
        "Error: COSMOS_CONNECTION_STRING environment variable not set"
      );
      return null;
    }
    standupInstance = new Standup();
    await standupInstance.initialize(cosmosConnectionString);
  }
  return standupInstance;
}
