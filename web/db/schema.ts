import { sqliteTable, text, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const elections = sqliteTable('elections', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
  state: text('state').notNull().default('OPEN'), created: text('created').notNull(), config: text('config'),
}, t => [index('elections_owner_created').on(t.owner,t.created)]);
export const candidates = sqliteTable('candidates', {
  election: text('election').notNull().references(() => elections.id), id: text('id').notNull(), label: text('label').notNull(),
}, t => [primaryKey({ columns: [t.election, t.id] })]);
export const eligible = sqliteTable('eligible', {
  election: text('election').notNull().references(() => elections.id), voter: text('voter').notNull(),
}, t => [primaryKey({ columns: [t.election, t.voter] })]);
export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(), election: text('election').notNull().references(() => elections.id),
  voter: text('voter').notNull(), candidate: text('candidate').notNull(), request: text('request').notNull(),
  code: text('code').notNull(), created: text('created').notNull(),
}, t => [uniqueIndex('one_request').on(t.election,t.voter,t.request),
  uniqueIndex('one_accepted_vote').on(t.election,t.voter).where(sql`${t.code} = 'ACCEPTED'`),
  index('submissions_election').on(t.election), index('accepted_candidate_tally').on(t.election,t.candidate).where(sql`${t.code} = 'ACCEPTED'`)]);
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), election: text('election').notNull().references(() => elections.id),
  voter: text('voter'), code: text('code').notNull(), created: text('created').notNull(),
});
