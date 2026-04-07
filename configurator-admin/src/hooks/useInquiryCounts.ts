import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { countNewInquiries } from '@/lib/inquiries'

export function useInquiryCounts() {
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    // Initial load
    countNewInquiries().then(setNewCount)

    // Subscribe to real-time inserts on inquiries
    const channel = supabase
      .channel('inquiry-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiries' },
        () => countNewInquiries().then(setNewCount)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiries' },
        () => countNewInquiries().then(setNewCount)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return { newCount }
}
