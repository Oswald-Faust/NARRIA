import { Schema, model, models } from "mongoose";

export const PROJECT_ROLES = ["owner", "co-admin", "collaborateur", "lecteur"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

const ProjectMemberSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: PROJECT_ROLES, required: true },
  },
  { timestamps: true },
);

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMember = models.ProjectMember || model("ProjectMember", ProjectMemberSchema);
