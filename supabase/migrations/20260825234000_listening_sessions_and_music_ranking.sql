-- Histórico persistente por sessão e ranking agregado de músicas.
ALTER TABLE public.listening_history
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS listening_history_user_session_uidx
  ON public.listening_history (user_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS listening_history_music_played_at_idx
  ON public.listening_history (music_id, played_at DESC);

CREATE OR REPLACE FUNCTION public.record_listening_session(
  p_user_id uuid,
  p_music_id bigint,
  p_session_id uuid,
  p_listened_seconds integer,
  p_completed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF p_session_id IS NULL OR p_listened_seconds IS NULL OR p_listened_seconds < 1 THEN
    RETURN;
  END IF;

  INSERT INTO public.listening_history
    (user_id, music_id, session_id, listened_seconds, completed, played_at)
  VALUES
    (p_user_id, p_music_id, p_session_id, GREATEST(p_listened_seconds, 0), COALESCE(p_completed, false), now())
  ON CONFLICT (user_id, session_id) WHERE session_id IS NOT NULL DO UPDATE
    SET listened_seconds = GREATEST(listening_history.listened_seconds, EXCLUDED.listened_seconds),
        completed = listening_history.completed OR EXCLUDED.completed,
        played_at = GREATEST(listening_history.played_at, EXCLUDED.played_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_listening_session(uuid, bigint, uuid, integer, boolean)
  TO authenticated;

DROP FUNCTION IF EXISTS public.get_music_listening_ranking(integer, integer);

CREATE OR REPLACE FUNCTION public.get_music_listening_ranking(
  p_limit integer DEFAULT 10,
  p_days integer DEFAULT NULL
)
RETURNS TABLE (
  music_id bigint,
  title text,
  artist text,
  cover text,
  play_count bigint,
  total_listened_seconds bigint,
  unique_listeners bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id::bigint,
    m.title::text,
    m.artist::text,
    m.cover::text,
    COUNT(lh.id)::bigint,
    COALESCE(SUM(GREATEST(COALESCE(lh.listened_seconds, 0), 0)), 0)::bigint,
    COUNT(DISTINCT lh.user_id)::bigint
  FROM public.listening_history lh
  JOIN public.musics m ON m.id = lh.music_id
  WHERE m.visibility = 'public'
    AND (p_days IS NULL OR lh.played_at >= now() - make_interval(days => GREATEST(p_days, 0)))
  GROUP BY m.id, m.title, m.artist, m.cover
  ORDER BY COUNT(lh.id) DESC,
           COALESCE(SUM(GREATEST(COALESCE(lh.listened_seconds, 0), 0)), 0) DESC,
           MAX(lh.played_at) DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.get_music_listening_ranking(integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_music_listening_ranking(integer, integer) TO authenticated;
