import { createPageSelectionCard } from "../models/AdaptiveCards";
import { Standup } from "../models/Standup";
import { OneNoteStorage } from "../services/OneNoteStorage";
import { NoStorage } from "../services/Storage";
import { CommandContext } from "./types";

export async function executeRegister(
  context: CommandContext,
  standup: Standup,
  text: string
) {
  const { send, conversationId, userId, userName, api } = context;

  // Check if group already exists
  if (await standup.validateGroup(conversationId)) {
    await send("A standup group is already registered for this conversation.");
    return;
  }

  if (!(text.includes("one") && text.includes("note"))) {
    // Create a new group with no storage if OneNote isn't specified
    const result = await standup.registerGroup(
      conversationId,
      new NoStorage(),
      {
        id: userId,
        name: userName,
      }
    );
    await send(
      result.type === "success" ? result.data.message : result.message
    );
    return;
  }

  // Create storage and get available pages
  const storage = new OneNoteStorage((api.user as any).http, "", {});
  const pagesResult = await storage.getPages();
  if (pagesResult.type === "error") {
    await send(`Failed to get OneNote pages: ${pagesResult.message}`);
    return;
  }

  if (pagesResult.data.length === 0) {
    await send("No OneNote pages found. Please create a page first.");
    return;
  }

  // Create 1:1 chat with user and send page selection card there
  const res = await api.conversations.create({
    tenantId: context.conversationId.split("/")[0],
    isGroup: false,
    bot: { id: api.botId },
    members: [{ id: userId, name: userName }],
  });

  // Send page selection card to user in 1:1 chat
  await api.send(res.id, {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: createPageSelectionCard(pagesResult.data, conversationId),
      },
    ],
  });

  // Notify in group chat
  await send(
    "📝 I've sent you a private message to select a OneNote page for registration."
  );
}
