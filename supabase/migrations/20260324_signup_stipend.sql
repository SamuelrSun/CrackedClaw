-- Update handle_new_user to grant $5 welcome stipend
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, balance_usd, total_deposited_usd)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    5.00,   -- $5 welcome stipend
    5.00    -- Track as deposited
  );
  
  -- Record the stipend transaction
  INSERT INTO public.wallet_transactions (user_id, type, amount_usd, description)
  VALUES (NEW.id, 'stipend', 5.00, 'Welcome bonus');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
