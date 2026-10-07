// Which sidebar pages get an "Add" form, and which rows get action buttons.
// Keys are the page path after /admin/ (the sidebar slug).

const hackathon = {
  name: 'hackathon_id', label: 'Hackathon', type: 'select', required: true,
  optionsFrom: '/admin/hackathons/all-hackathons', labelKey: 'name', valueKey: 'id',
  emptyHint: 'No hackathons yet — add one first.',
}
const member = {
  name: 'user_email', label: 'Member', type: 'select', required: true,
  optionsFrom: '/admin/members', labelKey: 'full_name', valueKey: 'email', labelExtra: 'email',
}

const forms = {}
const addForm = (paths, cfg) => paths.forEach((p) => { forms[p] = cfg })

addForm(['certificates/generate', 'certificates/issued'], {
  title: 'Issue Certificate', button: 'Issue certificate', endpoint: '/admin/certificates',
  fields: [
    member,
    { name: 'activity_type', label: 'Activity type', type: 'select', required: true, default: 'event',
      options: ['event', 'hackathon', 'workshop', 'volunteer', 'mentorship', 'other'] },
    { name: 'title', label: 'Certificate title', required: true, wide: true,
      placeholder: 'e.g. TSC Hackathon 2026 – Participant' },
  ],
})

addForm(['hackathons/all-hackathons'], {
  title: 'Add Hackathon', button: 'Add hackathon', endpoint: '/admin/hackathons',
  fields: [
    { name: 'name', label: 'Name', required: true, wide: true, placeholder: 'e.g. TSC Hackathon 2026' },
    { name: 'venue', label: 'Venue', placeholder: 'e.g. Lodwar Youth Centre' },
    { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
    { name: 'ends_at', label: 'Ends at', type: 'datetime-local' },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
    { name: 'rules', label: 'Rules', type: 'textarea', wide: true },
    { name: 'schedule', label: 'Schedule', type: 'textarea', wide: true },
  ],
})

addForm(['hackathons/challenges'], {
  title: 'Add Challenge / Track', button: 'Add challenge', endpoint: '/admin/hackathons/challenges',
  fields: [
    hackathon,
    { name: 'name', label: 'Challenge name', required: true },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm(['hackathons/judges'], {
  title: 'Add Judge', button: 'Add judge', endpoint: '/admin/hackathons/judges',
  fields: [hackathon, { ...member, label: 'Judge' }],
})

addForm(['hackathons/participants'], {
  title: 'Add Participant', button: 'Add participant', endpoint: '/admin/hackathons/participants',
  fields: [hackathon, { ...member, label: 'Participant' }],
})

addForm(['hackathons/criteria'], {
  title: 'Add Judging Criterion', button: 'Add criterion', endpoint: '/admin/hackathons/criteria',
  fields: [
    hackathon,
    { name: 'name', label: 'Criterion', required: true, placeholder: 'e.g. Innovation' },
    { name: 'weight', label: 'Weight', type: 'number', default: 1 },
    { name: 'max_score', label: 'Max score', type: 'number', default: 10 },
  ],
})

addForm(['chapters/all-chapters', 'chapters/create-chapter'], {
  title: 'Create Chapter', button: 'Create chapter', endpoint: '/admin/chapters',
  fields: [
    { name: 'name', label: 'Chapter name', required: true, placeholder: 'e.g. TSC Kakuma' },
    { name: 'location', label: 'Location' },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm(['events/create-event'], {
  title: 'Create Event', button: 'Create event', endpoint: '/admin/events',
  fields: [
    { name: 'title', label: 'Title', required: true, wide: true },
    { name: 'location', label: 'Location' },
    { name: 'capacity', label: 'Capacity', type: 'number' },
    { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
    { name: 'ends_at', label: 'Ends at', type: 'datetime-local' },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm([
  'opportunities/all', 'opportunities/jobs', 'opportunities/grants',
  'opportunities/internships', 'opportunities/competitions', 'opportunities/pending-approval',
], {
  title: 'Add Opportunity', button: 'Add opportunity', endpoint: '/admin/opportunities',
  fields: [
    { name: 'type', label: 'Type', type: 'select', required: true, default: 'Job',
      options: ['Job', 'Grant', 'Internship', 'Competition', 'Fellowship', 'Hackathon'] },
    { name: 'title', label: 'Title', required: true },
    { name: 'organization', label: 'Organization' },
    { name: 'location', label: 'Location' },
    { name: 'link', label: 'Link', placeholder: 'https://…' },
    { name: 'deadline', label: 'Deadline', type: 'datetime-local' },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm(['resources/all-resources', 'resources/upload'], {
  title: 'Add Resource', button: 'Add resource', endpoint: '/admin/resources',
  fields: [
    { name: 'category', label: 'Category', type: 'select', required: true, default: 'Startup guides',
      options: ['Startup guides', 'Pitch decks', 'AI', 'Funding', 'Legal', 'Other'] },
    { name: 'title', label: 'Title', required: true },
    { name: 'external_url', label: 'Link', placeholder: 'https://…', wide: true },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm(['sponsors-partners/sponsors', 'sponsors-partners/partners', 'sponsors-partners/partnerships'], {
  title: 'Add Sponsor / Partner', button: 'Add sponsor / partner', endpoint: '/admin/sponsors',
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'partnership_type', label: 'Type', type: 'select', required: true, default: 'Sponsor',
      options: ['Sponsor', 'Partner'] },
    { name: 'website', label: 'Website' },
    { name: 'contact_email', label: 'Contact email' },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm(['achievements/badges'], {
  title: 'Create Badge', button: 'Create badge', endpoint: '/admin/achievements/badges',
  fields: [
    { name: 'name', label: 'Badge name', required: true },
    { name: 'icon', label: 'Icon / emoji' },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm(['achievements/member-achievements', 'achievements/recognition'], {
  title: 'Award Badge', button: 'Award badge', endpoint: '/admin/achievements/award',
  fields: [
    member,
    { name: 'badge_id', label: 'Badge', type: 'select', required: true,
      optionsFrom: '/admin/achievements/badges', labelKey: 'name', valueKey: 'id',
      emptyHint: 'No badges yet — create one first.' },
  ],
})

addForm(['incubation/programs'], {
  title: 'Add Incubation Program', button: 'Add program', endpoint: '/admin/incubation/programs',
  fields: [
    { name: 'name', label: 'Program name', required: true },
    { name: 'cohort_name', label: 'Cohort' },
    { name: 'application_deadline', label: 'Application deadline', type: 'datetime-local' },
    { name: 'status', label: 'Status', type: 'select', default: 'open',
      options: ['open', 'closed', 'running', 'completed'] },
    { name: 'description', label: 'Description', type: 'textarea', wide: true },
  ],
})

addForm(['communications/announcements', 'communications/notifications'], {
  title: 'Send Announcement', button: 'Send announcement',
  endpoint: '/admin/communications/announcements',
  fields: [
    { name: 'title', label: 'Title', required: true, wide: true },
    { name: 'body', label: 'Message', type: 'textarea', wide: true },
  ],
})

export const FORMS = forms

// ---------------------------------------------------------------- row actions
const rowActions = {}
const addActions = (paths, list) => paths.forEach((p) => { rowActions[p] = list })

const G = 'green', R = 'red', N = 'gray'

addActions(
  ['projects/all-projects', 'projects/pending-approval', 'projects/featured', 'projects/showcase'], [
    { label: 'Approve', base: 'projects', action: 'approve', tone: G, when: (r) => r.status !== 'approved' },
    { label: 'Reject', base: 'projects', action: 'reject', tone: R, confirm: 'Reject this project?',
      when: (r) => r.status === 'pending' },
    { label: 'Feature', base: 'projects', action: 'feature', tone: N,
      when: (r) => r.status === 'approved' && r.is_featured !== '1' },
    { label: 'Unfeature', base: 'projects', action: 'unfeature', tone: N, when: (r) => r.is_featured === '1' },
  ])

addActions(
  ['startups/all-startups', 'startups/pending-approval', 'startups/featured', 'startups/verification'], [
    { label: 'Verify', base: 'startups', action: 'verify', tone: G, when: (r) => r.status === 'pending' },
    { label: 'Reject', base: 'startups', action: 'reject', tone: R, confirm: 'Reject this startup?',
      when: (r) => r.status === 'pending' },
    { label: 'Feature', base: 'startups', action: 'feature', tone: N,
      when: (r) => r.status === 'verified' && r.is_featured !== '1' },
    { label: 'Unfeature', base: 'startups', action: 'unfeature', tone: N, when: (r) => r.is_featured === '1' },
  ])

addActions([
  'opportunities/all', 'opportunities/jobs', 'opportunities/grants',
  'opportunities/internships', 'opportunities/competitions', 'opportunities/pending-approval',
], [
  { label: 'Approve', base: 'opportunities', action: 'approve', tone: G, when: (r) => r.status === 'pending' },
  { label: 'Close', base: 'opportunities', action: 'close', tone: N, when: (r) => r.status === 'approved' },
])

addActions(['resources/all-resources', 'resources/pending-approval'], [
  { label: 'Approve', base: 'resources', action: 'approve', tone: G, when: (r) => r.status !== 'approved' },
  { label: 'Reject', base: 'resources', action: 'reject', tone: R, when: (r) => r.status === 'pending' },
])

addActions(['sponsors-partners/sponsors', 'sponsors-partners/partners', 'sponsors-partners/partnerships'], [
  { label: 'Approve', base: 'sponsors', action: 'approve', tone: G, when: (r) => r.status === 'pending' },
])

addActions(['volunteers/applications'], [
  { label: 'Approve', base: 'volunteers', action: 'approve', tone: G, when: (r) => r.status === 'pending' },
  { label: 'Reject', base: 'volunteers', action: 'reject', tone: R, when: (r) => r.status === 'pending' },
])

addActions(['mentorship/requests'], [
  { label: 'Accept', base: 'mentorship/requests', action: 'accept', tone: G, when: (r) => r.status === 'pending' },
  { label: 'Reject', base: 'mentorship/requests', action: 'reject', tone: R, when: (r) => r.status === 'pending' },
])

addActions(['moderation/reports', 'community/reports', 'community/moderation', 'networking/reports'], [
  { label: 'Resolve', base: 'moderation/reports', action: 'resolve', tone: G, when: (r) => r.status === 'open' },
  { label: 'Dismiss', base: 'moderation/reports', action: 'dismiss', tone: N, when: (r) => r.status === 'open' },
])

addActions(['hackathons/all-hackathons'], [
  { label: 'Go live', base: 'hackathons', action: 'go-live', tone: G, when: (r) => r.status === 'upcoming' },
  { label: 'Start judging', base: 'hackathons', action: 'start-judging', tone: N, when: (r) => r.status === 'live' },
  { label: 'Complete', base: 'hackathons', action: 'complete', tone: N, when: (r) => r.status === 'judging' },
  { label: 'Archive', base: 'hackathons', action: 'archive', tone: N, when: (r) => r.status === 'completed' },
])

addActions(['events/create-event'], [
  { label: 'Publish', base: 'events', action: 'publish', tone: G, when: (r) => r.status === 'draft' },
])

addActions(['moderation/suspended-users'], [
  { label: 'Reactivate', base: 'members', action: 'reactivate', tone: G, when: () => true },
])

addActions(['community/posts'], [
  { label: 'Hide', base: 'community/posts', action: 'hide', tone: N, when: (r) => !r.hidden },
  { label: 'Unhide', base: 'community/posts', action: 'unhide', tone: G, when: (r) => r.hidden },
  { label: 'Delete', base: 'community/posts', action: 'delete', tone: R,
    confirm: 'Delete this post permanently?', when: () => true },
])

addActions(['community/comments'], [
  { label: 'Hide', base: 'community/comments', action: 'hide', tone: N, when: (r) => !r.hidden },
  { label: 'Unhide', base: 'community/comments', action: 'unhide', tone: G, when: (r) => r.hidden },
  { label: 'Delete', base: 'community/comments', action: 'delete', tone: R,
    confirm: 'Delete this comment permanently?', when: () => true },
])


export const ROW_ACTIONS = rowActions