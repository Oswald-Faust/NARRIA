import { Schema, model, models } from "mongoose";

const ProjectInvitationSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ["co-admin", "collaborateur", "lecteur"], required: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    invitedByUserId: { type: String, required: true },
  },
  { timestamps: true },
);

export const ProjectInvitation =
  models.ProjectInvitation || model("ProjectInvitation", ProjectInvitationSchema);
