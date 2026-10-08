import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

const LAST_UPDATED = '7 October 2026'
const CONTACT_EMAIL = '[contact email]'          // TODO: fill in
const ORG_ADDRESS = '[registered address, Turkana County, Kenya]' // TODO: fill in

function H({ id, children }) {
  return <h2 id={id} className="text-lg font-semibold mt-8 mb-2 scroll-mt-6">{children}</h2>
}

export default function Terms() {
  const { hash } = useLocation()

  // jump to #privacy when opened from the Privacy Notice link
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [hash])

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <article className="bg-white p-8 rounded-xl shadow-md w-full max-w-3xl mx-auto text-sm leading-relaxed text-gray-700">
        <Link to="/register" className="text-emerald-700 hover:underline">← Back to registration</Link>

        <h1 className="text-2xl font-bold text-emerald-700 mt-4">Terms and Conditions</h1>
        <p className="text-gray-500 mt-1">Turkana Startup Club (TSC) · Last updated {LAST_UPDATED}</p>

        <H>1. Acceptance of these terms</H>
        <p>
          By creating an account or using the TSC platform you agree to these Terms and Conditions and to
          the Privacy Notice below. If you do not agree, please do not register or use the platform.
        </p>

        <H>2. Who can join</H>
        <p>
          You must be at least 18 years old, or have the permission of a parent or guardian, to create an
          account. You agree that the information you give us when you register is accurate, and that you
          will keep it up to date.
        </p>

        <H>3. Your account</H>
        <ul className="list-disc pl-6 space-y-1">
          <li>You are responsible for keeping your password confidential and for everything done through your account.</li>
          <li>One person, one account. Do not share your account or pretend to be someone else.</li>
          <li>Tell us promptly if you think your account has been accessed without your permission.</li>
        </ul>

        <H>4. Community conduct</H>
        <p>When you use the directory, community feed, messages, events and hackathons, you agree not to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>harass, threaten, bully or discriminate against anyone;</li>
          <li>post or send unlawful, hateful, sexually explicit, deceptive or misleading content;</li>
          <li>send spam, unsolicited advertising, scams or chain messages, including through connection requests and direct messages;</li>
          <li>collect other members' details to market to them or to share them outside the platform without their consent;</li>
          <li>upload malware, or try to break, overload or gain unauthorised access to the platform or other accounts;</li>
          <li>infringe anyone's intellectual property or privacy rights.</li>
        </ul>

        <H>5. Your content</H>
        <p>
          You keep ownership of what you post (profile details, posts, comments, photos and messages). You
          give TSC a limited licence to store, display and deliver that content on the platform so the
          service can work. You are responsible for what you post. Moderators may hide or remove content
          that breaks these terms.
        </p>

        <H>6. Connections and messages</H>
        <ul className="list-disc pl-6 space-y-1">
          <li>Members you connect with can see the contact details and links you add to your profile (such as phone, LinkedIn, GitHub, portfolio and startup information), and can message you.</li>
          <li>You can disconnect at any time, which ends their access to those details and to messaging with you.</li>
          <li>Direct messages are stored on the platform. Do not send passwords, payment details or other highly sensitive information in messages.</li>
        </ul>

        <H>7. Events, hackathons and certificates</H>
        <p>
          Event and hackathon participation may be subject to extra rules published for each activity.
          Certificates are issued by TSC administrators, can be verified through the platform, and may be
          withdrawn if they were issued in error or obtained through dishonesty.
        </p>

        <H>8. Suspension and removal</H>
        <p>
          We may warn, suspend or remove accounts or content that break these terms or put other members at
          risk. You may stop using the platform at any time and may ask us to delete your account.
        </p>

        <H>9. Disclaimers and liability</H>
        <p>
          TSC is a community platform. Members' posts, opportunities, startup information and mentorship are
          offered by individuals, and we do not guarantee their accuracy or outcomes. Do your own checks
          before sharing money or sensitive information, or entering agreements with other members. The
          platform is provided "as is". To the extent the law allows, TSC is not liable for losses arising
          from your use of the platform or from dealings between members.
        </p>

        <H>10. Changes to these terms</H>
        <p>
          We may update these terms from time to time. We will show the new "last updated" date, and
          continued use of the platform after a change means you accept the updated terms.
        </p>

        <H>11. Governing law</H>
        <p>These terms are governed by the laws of Kenya.</p>

        <H id="privacy">12. Privacy Notice</H>
        <p>This explains what we collect and why. We handle personal data in line with Kenya's Data Protection Act, 2019.</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong>What we collect:</strong> the details you give at registration and in your profile (name, email, phone, location, institution, role, skills, links, bio, photo), your posts, comments, connections, messages, event and hackathon activity, and basic security logs (such as login and account actions).</li>
          <li><strong>Why we use it:</strong> to run your account, show your profile in the member directory, let you connect and message other members, run events, hackathons and certificates, send notifications, keep the platform safe, and understand how it is used.</li>
          <li><strong>Who can see it:</strong> signed-in members can see your directory profile. Your contact details and links are visible only to members you are connected with. Your bio can be hidden from the directory in Settings. Administrators and moderators can access data where needed to run and protect the platform.</li>
          <li><strong>Sharing:</strong> we do not sell your personal data. We share it only with service providers who help us run the platform (for example email delivery and hosting), or where the law requires it.</li>
          <li><strong>Keeping it safe:</strong> passwords are stored in hashed form, and access is limited to people who need it. No system is perfectly secure, so please use a strong, unique password.</li>
          <li><strong>Your rights:</strong> you may ask to see, correct or delete your personal data, to object to certain uses, and to complain to the Office of the Data Protection Commissioner. You can edit most of your data yourself in Settings.</li>
          <li><strong>Retention:</strong> we keep your data while your account is active and for as long as needed afterwards for legal or security reasons.</li>
        </ul>

        <H>13. Contact</H>
        <p>
          Questions about these terms or your data: natwomdaniel@gmail.com<br />
          {ORG_ADDRESS}
        </p>
      </article>
    </div>
  )
}