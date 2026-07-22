import { migrationRunner } from '@forge/sql';

// Schema definitions for all four tables (CONTEXT.md §4). Migrations are the
// "model definition" layer: DDL run once per environment by the migration
// runner — they never see requests and are not a validation mechanism
// (CONTEXT.md §3.8). Constraints here are the last-resort backstop behind the
// zod + service layers.
//
// IMPORTANT: migrations are append-only. Never edit a statement after it has
// run anywhere — add a new vNNN entry instead.
//
// Note: relationships (restaurant_id → restaurants.id) are documented here
// but not declared as FOREIGN KEY constraints; referential rules are enforced
// in the service layer, which also owns soft-delete semantics.

const CREATE_RESTAURANTS = `
CREATE TABLE IF NOT EXISTS restaurants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  website VARCHAR(255) NULL,
  menu_url VARCHAR(255) NULL,
  created_by VARCHAR(128) NOT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uniq_restaurant_identity (name, phone, address)
)`;

const CREATE_USER_SAVED_RESTAURANTS = `
CREATE TABLE IF NOT EXISTS user_saved_restaurants (
  account_id VARCHAR(128) NOT NULL,
  restaurant_id INT NOT NULL,
  PRIMARY KEY (account_id, restaurant_id)
)`;

const CREATE_USER_CURRENT_SUBMISSION = `
CREATE TABLE IF NOT EXISTS user_current_submission (
  account_id VARCHAR(128) NOT NULL,
  restaurant_id INT NOT NULL,
  total DECIMAL(10, 2) NULL,
  notes TEXT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id)
)`;

const CREATE_ORDERS = `
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id VARCHAR(128) NOT NULL,
  restaurant_id INT NOT NULL,
  ordered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(10, 2) NULL,
  notes TEXT NULL,
  KEY idx_orders_account_ordered (account_id, ordered_at)
)`;

// v005/v006: free-text description of what was actually ordered. Named
// "items" because ORDER is a reserved SQL keyword.
const ADD_ITEMS_TO_SUBMISSION = `
ALTER TABLE user_current_submission ADD COLUMN items TEXT NULL`;

const ADD_ITEMS_TO_ORDERS = `
ALTER TABLE orders ADD COLUMN items TEXT NULL`;

// v007/v008: Teams (group ordering). A team is a named group a user can join;
// team_members is the join table (account_id side is the Atlassian accountId,
// not a users table — CONTEXT.md §3.3). name_normalized (trim+lowercase) has a
// UNIQUE backstop so "Joe's" and "joe's" can't both exist; the service checks
// it first and links the caller to the existing team on a match.
const CREATE_TEAMS = `
CREATE TABLE IF NOT EXISTS teams (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  name_normalized VARCHAR(255) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_team_name (name_normalized)
)`;

const CREATE_TEAM_MEMBERS = `
CREATE TABLE IF NOT EXISTS team_members (
  account_id VARCHAR(128) NOT NULL,
  team_id INT NOT NULL,
  PRIMARY KEY (account_id, team_id)
)`;

// v009–v011: Outings ("events"). An outing is one restaurant at one time,
// hosted by a Lunch Boss and visible to a chosen set of teams. host_account_id
// is NULL when the outing is up for grabs (resign/claim — later slice).
// original_scheduled_at is set = scheduled_at at creation and never changed, so
// we can show "time changed" later. event_orders is created here (empty) so the
// outing behaviors that query it — visibility "do I have an order?" and the
// delete "zero orders" guard — can run now; order submission logic comes later.
const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  host_account_id VARCHAR(128) NULL,
  created_by VARCHAR(128) NOT NULL,
  restaurant_id INT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  original_scheduled_at TIMESTAMP NOT NULL,
  placed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_events_scheduled (scheduled_at)
)`;

const CREATE_EVENT_TEAMS = `
CREATE TABLE IF NOT EXISTS event_teams (
  event_id INT NOT NULL,
  team_id INT NOT NULL,
  PRIMARY KEY (event_id, team_id),
  KEY idx_event_teams_team (team_id)
)`;

const CREATE_EVENT_ORDERS = `
CREATE TABLE IF NOT EXISTS event_orders (
  event_id INT NOT NULL,
  account_id VARCHAR(128) NOT NULL,
  items TEXT NULL,
  total DECIMAL(10, 2) NULL,
  notes TEXT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, account_id),
  KEY idx_event_orders_account (account_id)
)`;

// NULL = a solo order; set = the event this order was batch-placed from.
// Lets history show group context and lets us query orders by team / Lunch
// Boss / date transitively through the event.
const ADD_EVENT_ID_TO_ORDERS = `
ALTER TABLE orders ADD COLUMN event_id INT NULL`;

const migrations = migrationRunner
  .enqueue('v001_create_restaurants', CREATE_RESTAURANTS)
  .enqueue('v002_create_user_saved_restaurants', CREATE_USER_SAVED_RESTAURANTS)
  .enqueue('v003_create_user_current_submission', CREATE_USER_CURRENT_SUBMISSION)
  .enqueue('v004_create_orders', CREATE_ORDERS)
  .enqueue('v005_add_items_to_user_current_submission', ADD_ITEMS_TO_SUBMISSION)
  .enqueue('v006_add_items_to_orders', ADD_ITEMS_TO_ORDERS)
  .enqueue('v007_create_teams', CREATE_TEAMS)
  .enqueue('v008_create_team_members', CREATE_TEAM_MEMBERS)
  .enqueue('v009_create_events', CREATE_EVENTS)
  .enqueue('v010_create_event_teams', CREATE_EVENT_TEAMS)
  .enqueue('v011_create_event_orders', CREATE_EVENT_ORDERS)
  .enqueue('v012_add_event_id_to_orders', ADD_EVENT_ID_TO_ORDERS);

export const applyMigrations = async (): Promise<string[]> => {
  const applied = await migrations.run();
  console.log('Migrations applied:', applied);
  return applied;
};

// Entry point for the scheduled trigger (manifest: index.migrationHandler).
// The trigger runs hourly so new installations get their schema without any
// manual step; already-applied migrations are skipped by the runner.
export const migrationHandler = async (): Promise<void> => {
  await applyMigrations();
};
