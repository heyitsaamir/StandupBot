import { cardAttachment } from "@microsoft/spark.api";
import { createTaskModule } from "../models/AdaptiveCards";
import { Standup } from "../models/Standup";
import { StandupResponse } from "../models/types";

export async function handleDialogOpen(activity: any) {
  return {
    task: {
      type: "continue" as const,
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
}

export async function handleDialogSubmit(
  activity: any,
  send: (message: any) => Promise<any>,
  standup: Standup
) {
  if (!standup) return;

  const conversationId = activity.conversation.id;
  const data = activity.value.data;

  const standupResponse: StandupResponse = {
    userId: activity.from.id,
    completedWork: data.completedWork,
    plannedWork: data.plannedWork,
    parkingLot: data.parkingLot,
    timestamp: new Date(),
  };

  const result = await standup.submitResponse(
    conversationId,
    standupResponse,
    activity.conversation.tenantId || "unknown",
    send
  );

  return {
    status: 200,
    body: {
      task: {
        type: "message",
        value: result.type === "success" ? result.data.message : result.message,
      },
    },
  };
}
