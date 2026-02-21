
// Stub implementation for supabase client
const supabase = {
  from: () => ({
    select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
    insert: () => ({ select: () => ({ single: () => ({ data: { id: 'mock-job-id', progress: {}, status: 'running' }, error: null }) }) }),
    update: () => ({ eq: () => ({}) }),
    upsert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) })
  })
};

export default supabase;
