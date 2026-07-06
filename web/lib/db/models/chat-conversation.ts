import { Schema, model, models } from "mongoose";

const ChatMessageSchema = new Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["system", "user", "assistant"], required: true },
    parts: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false },
);

const ChatConversationSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, required: true, default: "Nouvelle conversation" },
    messages: { type: [ChatMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
  },
  { timestamps: true },
);

ChatConversationSchema.index({ ownerId: 1, updatedAt: -1 });
ChatConversationSchema.index({ ownerId: 1, lastMessageAt: -1 });

export const ChatConversation =
  models.ChatConversation || model("ChatConversation", ChatConversationSchema);
