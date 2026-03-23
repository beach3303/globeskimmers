import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const ADMIN_EMAILS = ['maizasimeon@gmail.com', 'founder@globeskimmers.io'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check if user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return Response.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }
    
    // Use service role to fetch all data
    const [users, events, featureRequests, contactMessages] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.UserEvent.list(),
      base44.asServiceRole.entities.FeatureRequest.list(),
      base44.asServiceRole.entities.ContactMessage.list()
    ]);
    
    return Response.json({
      users,
      events,
      featureRequests,
      contactMessages
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});