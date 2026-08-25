-- Os dados agregados do ranking não devem ser consultáveis anonimamente.
REVOKE ALL ON FUNCTION public.get_music_listening_ranking(integer, integer)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_music_listening_ranking(integer, integer)
  TO authenticated;

REVOKE ALL ON FUNCTION public.record_listening_session(uuid, bigint, uuid, integer, boolean)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_listening_session(uuid, bigint, uuid, integer, boolean)
  TO authenticated;
