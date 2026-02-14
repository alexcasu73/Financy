--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Homebrew)
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AlertStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AlertStatus" AS ENUM (
    'active',
    'triggered',
    'paused',
    'expired'
);


--
-- Name: AlertType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AlertType" AS ENUM (
    'price_above',
    'price_below',
    'percent_change',
    'volume_spike',
    'technical_signal'
);


--
-- Name: AssetType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AssetType" AS ENUM (
    'stock',
    'crypto',
    'etf',
    'bond',
    'commodity'
);


--
-- Name: TradingAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TradingAction" AS ENUM (
    'BUY',
    'SELL',
    'HOLD'
);


--
-- Name: TradingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TradingStatus" AS ENUM (
    'watching',
    'bought',
    'sold'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: alert_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_history (
    id text NOT NULL,
    alert_id text NOT NULL,
    triggered_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    price_at_trigger double precision NOT NULL,
    message text NOT NULL,
    notified boolean DEFAULT false NOT NULL
);


--
-- Name: alert_price_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_price_tracks (
    id text NOT NULL,
    alert_id text NOT NULL,
    price double precision NOT NULL,
    threshold double precision NOT NULL,
    recorded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: alert_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_suggestions (
    id text NOT NULL,
    asset_id text NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    threshold double precision NOT NULL,
    reason text NOT NULL,
    confidence text NOT NULL,
    dismissed boolean DEFAULT false NOT NULL,
    accepted_alert_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason_original text
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id text NOT NULL,
    user_id text NOT NULL,
    asset_id text NOT NULL,
    type public."AlertType" NOT NULL,
    condition jsonb NOT NULL,
    status public."AlertStatus" DEFAULT 'active'::public."AlertStatus" NOT NULL,
    channels jsonb NOT NULL,
    last_triggered_at timestamp(3) without time zone,
    trigger_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    is_tracking boolean DEFAULT false NOT NULL,
    tracking_started_at timestamp(3) without time zone
);


--
-- Name: analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analyses (
    id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    content text NOT NULL,
    sentiment text,
    assets jsonb,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: asset_calibrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_calibrations (
    id text NOT NULL,
    user_id text NOT NULL,
    asset_id text NOT NULL,
    adjustment_factor double precision DEFAULT 1.0 NOT NULL,
    reference_price double precision,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id text NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    type public."AssetType" NOT NULL,
    sector text,
    exchange text,
    currency text DEFAULT 'USD'::text NOT NULL,
    current_price double precision,
    previous_close double precision,
    change_percent double precision,
    market_cap double precision,
    volume double precision,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: economic_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.economic_indicators (
    id text NOT NULL,
    name text NOT NULL,
    value double precision NOT NULL,
    previous_value double precision,
    change double precision,
    unit text NOT NULL,
    country text NOT NULL,
    source text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holdings (
    id text NOT NULL,
    portfolio_id text NOT NULL,
    asset_id text NOT NULL,
    quantity double precision NOT NULL,
    avg_buy_price double precision NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    trading_asset_id text
);


--
-- Name: news_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_assets (
    news_item_id text NOT NULL,
    asset_id text NOT NULL
);


--
-- Name: news_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_items (
    id text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    url text NOT NULL,
    source text NOT NULL,
    image_url text,
    sentiment text,
    published_at timestamp(3) without time zone NOT NULL,
    fetched_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    summary_original text,
    title_original text
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    data jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dismissed boolean DEFAULT false NOT NULL
);


--
-- Name: portfolios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolios (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id text NOT NULL,
    asset_id text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    open double precision NOT NULL,
    high double precision NOT NULL,
    low double precision NOT NULL,
    close double precision NOT NULL,
    volume double precision NOT NULL
);


--
-- Name: technical_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technical_signals (
    id text NOT NULL,
    asset_id text NOT NULL,
    indicator text NOT NULL,
    signal text NOT NULL,
    value double precision NOT NULL,
    description text,
    calculated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: trading_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trading_assets (
    id text NOT NULL,
    profile_id text NOT NULL,
    asset_id text NOT NULL,
    status public."TradingStatus" DEFAULT 'watching'::public."TradingStatus" NOT NULL,
    entry_price double precision,
    entry_date timestamp(3) without time zone,
    quantity double precision,
    target_price double precision,
    stop_loss_price double precision,
    exit_price double precision,
    exit_date timestamp(3) without time zone,
    realized_profit_pct double precision,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    entry_price_native double precision
);


--
-- Name: trading_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trading_profiles (
    id text NOT NULL,
    user_id text NOT NULL,
    horizon text NOT NULL,
    risk_tolerance text NOT NULL,
    target_profit_pct double precision NOT NULL,
    max_loss_pct double precision NOT NULL,
    preferred_sectors text[],
    investment_per_trade double precision,
    analysis_interval integer DEFAULT 30 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    last_analysis_at timestamp(3) without time zone,
    last_suggestion_at timestamp(3) without time zone,
    suggestion_interval integer DEFAULT 360 NOT NULL,
    cash_balance double precision DEFAULT 0 NOT NULL,
    trading_style text DEFAULT 'swing'::text NOT NULL,
    resuggest_dismissed_after_days integer
);


--
-- Name: trading_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trading_signals (
    id text NOT NULL,
    trading_asset_id text NOT NULL,
    action public."TradingAction" NOT NULL,
    confidence text NOT NULL,
    reason text NOT NULL,
    price_at_signal double precision NOT NULL,
    criteria jsonb NOT NULL,
    notified boolean DEFAULT false NOT NULL,
    executed boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: trading_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trading_suggestions (
    id text NOT NULL,
    profile_id text NOT NULL,
    asset_id text NOT NULL,
    reason text NOT NULL,
    confidence text NOT NULL,
    expected_profit double precision,
    risk_level text,
    timeframe text,
    criteria jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    accepted_at timestamp(3) without time zone,
    dismissed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id text NOT NULL,
    user_id text NOT NULL,
    alert_suggestion_threshold double precision DEFAULT 3 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    sentiment_refresh_interval integer DEFAULT 5 NOT NULL,
    alert_suggestion_interval integer DEFAULT 360 NOT NULL,
    last_alert_suggestion_at timestamp(3) without time zone,
    telegram_chat_id text,
    telegram_enabled boolean DEFAULT false NOT NULL,
    reference_portfolio_value double precision,
    eur_price_adjustment_factor double precision DEFAULT 1.0 NOT NULL,
    last_calibration_at timestamp(3) without time zone
);


--
-- Name: COLUMN user_settings.reference_portfolio_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.reference_portfolio_value IS 'Reference portfolio value from external source (e.g., Trade Republic) for calibration';


--
-- Name: COLUMN user_settings.eur_price_adjustment_factor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.eur_price_adjustment_factor IS 'Auto-calculated factor to adjust EUR prices to match reference source';


--
-- Name: COLUMN user_settings.last_calibration_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.last_calibration_at IS 'Last time calibration was performed';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: watchlist_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watchlist_assets (
    watchlist_id text NOT NULL,
    asset_id text NOT NULL
);


--
-- Name: watchlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watchlists (
    id text NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: alert_history alert_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_history
    ADD CONSTRAINT alert_history_pkey PRIMARY KEY (id);


--
-- Name: alert_price_tracks alert_price_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_price_tracks
    ADD CONSTRAINT alert_price_tracks_pkey PRIMARY KEY (id);


--
-- Name: alert_suggestions alert_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_suggestions
    ADD CONSTRAINT alert_suggestions_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: analyses analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_pkey PRIMARY KEY (id);


--
-- Name: asset_calibrations asset_calibrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_calibrations
    ADD CONSTRAINT asset_calibrations_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: economic_indicators economic_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.economic_indicators
    ADD CONSTRAINT economic_indicators_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);


--
-- Name: news_assets news_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_assets
    ADD CONSTRAINT news_assets_pkey PRIMARY KEY (news_item_id, asset_id);


--
-- Name: news_items news_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_items
    ADD CONSTRAINT news_items_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: portfolios portfolios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolios
    ADD CONSTRAINT portfolios_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: technical_signals technical_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_signals
    ADD CONSTRAINT technical_signals_pkey PRIMARY KEY (id);


--
-- Name: trading_assets trading_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_assets
    ADD CONSTRAINT trading_assets_pkey PRIMARY KEY (id);


--
-- Name: trading_profiles trading_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_profiles
    ADD CONSTRAINT trading_profiles_pkey PRIMARY KEY (id);


--
-- Name: trading_signals trading_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_signals
    ADD CONSTRAINT trading_signals_pkey PRIMARY KEY (id);


--
-- Name: trading_suggestions trading_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_suggestions
    ADD CONSTRAINT trading_suggestions_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: watchlist_assets watchlist_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_assets
    ADD CONSTRAINT watchlist_assets_pkey PRIMARY KEY (watchlist_id, asset_id);


--
-- Name: watchlists watchlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlists
    ADD CONSTRAINT watchlists_pkey PRIMARY KEY (id);


--
-- Name: alert_price_tracks_alert_id_recorded_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alert_price_tracks_alert_id_recorded_at_idx ON public.alert_price_tracks USING btree (alert_id, recorded_at);


--
-- Name: asset_calibrations_user_id_asset_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX asset_calibrations_user_id_asset_id_key ON public.asset_calibrations USING btree (user_id, asset_id);


--
-- Name: assets_symbol_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX assets_symbol_key ON public.assets USING btree (symbol);


--
-- Name: holdings_portfolio_id_asset_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX holdings_portfolio_id_asset_id_key ON public.holdings USING btree (portfolio_id, asset_id);


--
-- Name: news_items_url_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX news_items_url_key ON public.news_items USING btree (url);


--
-- Name: price_history_asset_id_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX price_history_asset_id_date_key ON public.price_history USING btree (asset_id, date);


--
-- Name: trading_assets_profile_id_asset_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trading_assets_profile_id_asset_id_key ON public.trading_assets USING btree (profile_id, asset_id);


--
-- Name: trading_profiles_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trading_profiles_user_id_key ON public.trading_profiles USING btree (user_id);


--
-- Name: trading_suggestions_profile_id_asset_id_status_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trading_suggestions_profile_id_asset_id_status_key ON public.trading_suggestions USING btree (profile_id, asset_id, status);


--
-- Name: user_settings_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_settings_user_id_key ON public.user_settings USING btree (user_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: alert_history alert_history_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_history
    ADD CONSTRAINT alert_history_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alert_price_tracks alert_price_tracks_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_price_tracks
    ADD CONSTRAINT alert_price_tracks_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alert_suggestions alert_suggestions_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_suggestions
    ADD CONSTRAINT alert_suggestions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alerts alerts_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alerts alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: asset_calibrations asset_calibrations_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_calibrations
    ADD CONSTRAINT asset_calibrations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: asset_calibrations asset_calibrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_calibrations
    ADD CONSTRAINT asset_calibrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: holdings holdings_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: holdings holdings_portfolio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: holdings holdings_trading_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_trading_asset_id_fkey FOREIGN KEY (trading_asset_id) REFERENCES public.trading_assets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: news_assets news_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_assets
    ADD CONSTRAINT news_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: news_assets news_assets_news_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_assets
    ADD CONSTRAINT news_assets_news_item_id_fkey FOREIGN KEY (news_item_id) REFERENCES public.news_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: portfolios portfolios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolios
    ADD CONSTRAINT portfolios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: price_history price_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: technical_signals technical_signals_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_signals
    ADD CONSTRAINT technical_signals_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trading_assets trading_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_assets
    ADD CONSTRAINT trading_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trading_assets trading_assets_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_assets
    ADD CONSTRAINT trading_assets_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.trading_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trading_profiles trading_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_profiles
    ADD CONSTRAINT trading_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trading_signals trading_signals_trading_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_signals
    ADD CONSTRAINT trading_signals_trading_asset_id_fkey FOREIGN KEY (trading_asset_id) REFERENCES public.trading_assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trading_suggestions trading_suggestions_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_suggestions
    ADD CONSTRAINT trading_suggestions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trading_suggestions trading_suggestions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_suggestions
    ADD CONSTRAINT trading_suggestions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.trading_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: watchlist_assets watchlist_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_assets
    ADD CONSTRAINT watchlist_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: watchlist_assets watchlist_assets_watchlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_assets
    ADD CONSTRAINT watchlist_assets_watchlist_id_fkey FOREIGN KEY (watchlist_id) REFERENCES public.watchlists(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: watchlists watchlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlists
    ADD CONSTRAINT watchlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

