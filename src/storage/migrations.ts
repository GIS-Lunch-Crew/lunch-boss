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

const migrations = migrationRunner
  .enqueue('v001_create_restaurants', CREATE_RESTAURANTS)
  .enqueue('v002_create_user_saved_restaurants', CREATE_USER_SAVED_RESTAURANTS)
  .enqueue('v003_create_user_current_submission', CREATE_USER_CURRENT_SUBMISSION)
  .enqueue('v004_create_orders', CREATE_ORDERS)
  .enqueue('v005_add_items_to_user_current_submission', ADD_ITEMS_TO_SUBMISSION)
  .enqueue('v006_add_items_to_orders', ADD_ITEMS_TO_ORDERS);

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
