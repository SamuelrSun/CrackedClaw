-- Wallet system: balance columns on profiles + transaction history
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS balance_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_deposited_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_spent_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS auto_reload_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reload_amount NUMERIC(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_reload_threshold NUMERIC(10, 2) DEFAULT NULL;

-- Wallet transactions: deposits, stipends, refunds, auto-reloads
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,             -- 'deposit', 'stipend', 'refund', 'auto_reload'
  amount_usd NUMERIC(10, 4) NOT NULL,
  stripe_payment_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id, created_at DESC);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (true);

-- Atomic balance deduction function
CREATE OR REPLACE FUNCTION deduct_balance(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE profiles 
  SET balance_usd = balance_usd - p_amount,
      total_spent_usd = total_spent_usd + p_amount
  WHERE id = p_user_id AND balance_usd >= p_amount
  RETURNING balance_usd INTO new_balance;
  
  IF NOT FOUND THEN
    RETURN -1;  -- Insufficient balance
  END IF;
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic balance addition function (for deposits)
CREATE OR REPLACE FUNCTION add_balance(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE profiles 
  SET balance_usd = balance_usd + p_amount,
      total_deposited_usd = total_deposited_usd + p_amount
  WHERE id = p_user_id
  RETURNING balance_usd INTO new_balance;
  
  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
