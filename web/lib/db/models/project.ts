import { Schema, model, models } from "mongoose";

export const PROJECT_TYPES = [
  "Contentieux de plagiat",
  "Mandat d'agent",
  "Cession de droits",
  "Autre",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

const ProjectAttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, default: "" },
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ProjectSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: PROJECT_TYPES, default: "Autre" },
    category: { type: String, default: "" },
    summary: { type: String, default: "" },
    confidential: { type: Boolean, default: true },
    inviteLinkToken: { type: String, required: true, unique: true },
    inviteLinkRole: {
      type: String,
      enum: ["co-admin", "collaborateur", "lecteur"],
      default: "collaborateur",
    },
    attachments: { type: [ProjectAttachmentSchema], default: [] },
    archived: { type: Boolean, default: false },
    lastSynthesis: {
      text: { type: String, default: "" },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

export const Project = models.Project || model("Project", ProjectSchema);
