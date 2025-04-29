/*
  # Create notifications system

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `title` (text)
      - `message` (text) 
      - `type` (text)
      - `target_user_id` (uuid, nullable)
      - `read` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on notifications table
    - Add policies for:
      - Backoffice users can manage all notifications
      - Users can only view notifications targeted to them
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for backoffice users
CREATE POLICY "Backoffice users can delete notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM backoffice_users
    WHERE backoffice_users.user_id = auth.uid()
  ));

CREATE POLICY "Backoffice users can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM backoffice_users
    WHERE backoffice_users.user_id = auth.uid()
  ));

CREATE POLICY "Backoffice users can update notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM backoffice_users
    WHERE backoffice_users.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM backoffice_users
    WHERE backoffice_users.user_id = auth.uid()
  ));

-- Policy for users to view their notifications
CREATE POLICY "Users can view their notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (
    target_user_id = auth.uid() OR 
    target_user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM backoffice_users
      WHERE backoffice_users.user_id = auth.uid()
    )
  );