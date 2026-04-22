-- Enable Row Level Security on all workspace-scoped tables
-- These policies ensure complete tenant isolation at the DB level.
-- The application sets app.workspace_id via set_config() before each query.

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Workspace-scoped tables: workspace_id must match current setting
CREATE POLICY workspace_isolation ON memberships
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON audit_log
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON integrations
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON customers
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON customer_contacts
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON leads
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON lead_activities
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON campaigns
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON ad_sets
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON ads
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON campaign_metrics
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON invoices
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON quotes
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

CREATE POLICY workspace_isolation ON events
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);

-- workspaces: accessible if user is a member
CREATE POLICY workspace_access ON workspaces
  USING (id = current_setting('app.workspace_id', true)::uuid);

-- pgvector extension for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm for fuzzy search / duplicate detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;
