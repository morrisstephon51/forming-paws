create or replace function public.dog_is_baseline_verified(p_dog_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1 from public.health_documents
      where dog_id = p_dog_id
        and doc_type = 'vet_exam'
        and status = 'verified'
        and document_date >= (current_date - interval '12 months')
    )
    and exists (
      select 1 from public.health_documents
      where dog_id = p_dog_id
        and doc_type = 'vaccination'
        and status = 'verified'
    );
$$;
