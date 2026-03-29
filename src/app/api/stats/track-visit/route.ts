import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { pagePath, referrer } = await request.json()
    
    // Get IP address
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'
    
    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Get Supabase client
    const supabase = await createClient()
    
    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser()
    
    // Log the visit
    const { error } = await supabase
      .from('page_visits')
      .insert({
        page_path: pagePath,
        user_id: user?.id || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        referrer: referrer || null,
      })
    
    if (error) {
      console.error('Error logging visit:', error)
      return NextResponse.json(
        { error: 'Failed to log visit' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in visit logging:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
