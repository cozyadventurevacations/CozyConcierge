-- Run this separately before package-components.sql so the enum value is committed.
alter type public.component_type add value if not exists 'package';
