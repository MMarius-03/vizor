import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rift_rooms", {
  code: text("code").primaryKey(),
  state: text("state").notNull(),
  revision: integer("revision").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  consoleSeen: integer("console_seen").notNull().default(0),
  phoneSeen: integer("phone_seen").notNull().default(0),
});
