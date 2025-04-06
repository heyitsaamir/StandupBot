import { cardAttachment } from "@microsoft/spark.api";
import { createStandupCard } from "../models/AdaptiveCards";
import { Standup } from "../models/Standup";
import { CommandContext } from "./types";

export async function executeStartStandup(
  context: CommandContext,
  standup: Standup,
  shouldRestart = false
) {
  const { send, conversationId, tenantId } = context;

  if (shouldRestart) {
    const closeResult = await standup.closeStandup(
      conversationId,
      tenantId,
      false
    );
    if (closeResult.type === "error") {
      await send(closeResult.message);
      return;
    }
  }

  const sentActivity = await send({
    type: "message",
    attachments: [cardAttachment("adaptive", createStandupCard())],
  });

  const result = await standup.startStandup(
    conversationId,
    tenantId,
    sentActivity.id
  );
  if (result.type === "error") {
    await send(result.message);
  }
}

export async function executeCloseStandup(
  context: CommandContext,
  standup: Standup
) {
  const { send, conversationId, tenantId } = context;

  const result = await standup.closeStandup(conversationId, tenantId);
  if (result.type === "error") {
    await send(result.message);
    return;
  }

  if (result.data.summary) {
    await send(result.data.summary);
  }
}
