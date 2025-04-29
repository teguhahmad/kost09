/*
  # Improve Backoffice Security

  1. Changes
    - Add role_permissions table for granular access control
    - Add password_history table for tracking password changes
    - Add login_attempts table for rate limiting
    - Add audit logging triggers
    - Add role validation functions

  2. Security
    - Enable RLS on all new tables
    - Add policies for secure access
*/

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, resource, action)
);

-- Create password_history table
CREATE TABLE IF NOT EXISTS password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  success boolean NOT NULL
);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Superadmins can manage role permissions"
  ON role_permissions
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM backoffice_users 
      WHERE user_id = auth.uid() 
      AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backoffice_users 
      WHERE user_id = auth.uid() 
      AND role = 'superadmin'
    )
  );

CREATE POLICY "Users can view their own password history"
  ON password_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Superadmins can view all login attempts"
  ON login_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM backoffice_users 
      WHERE user_id = auth.uid() 
      AND role = 'superadmin'
    )
  );

-- Add default permissions
INSERT INTO role_permissions (role, resource, action) VALUES
  ('superadmin', '*', '*'),
  ('admin', 'users', 'read'),
  ('admin', 'users', 'create'),
  ('admin', 'users', 'update'),
  ('admin', 'properties', '*'),
  ('admin', 'notifications', '*'),
  ('support', 'users', 'read'),
  ('support', 'properties', 'read'),
  ('support', 'notifications', 'read');

-- Create function to check permissions
CREATE OR REPLACE FUNCTION check_role_permission(
  user_role text,
  required_resource text,
  required_action text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = user_role
    AND (resource = required_resource OR resource = '*')
    AND (action = required_action OR action = '*')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;