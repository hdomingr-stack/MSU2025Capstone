import { EmailTemplate } from '@/app/components/email-template';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);


export async function POST(req : Request) {
  const { to, match, email, anomaly } = await req.json();

  {/* Records the last sent timestamp, if within a set time frame, do not send another email */}
  const res = 
    await fetch(`http://18.119.9.9:3000/data/update_last_sent_timestamp?email=${to}&division=${match.division}&line=${match.line}&machine=${match.machine}&plant=${match.plant}&area=${match.area}&subarea=${match.subarea}&station=${match.station}&machine_type=${match.machine_type}`);
  const json = await res.json();

  if (!Array.isArray(json) || json.length === 0) {
    return Response.json({ message: 'Email recently sent. Please wait before sending another.' });
  }

  {/* Send the email using Resend */}
  const { data, error } = await resend.emails.send({
    from: 'alert-system@ai4cbm.xyz',
    to: to,
    subject: 'Maintenance Alert',
    react: EmailTemplate({
      division: email.division,
      line: email.line,
      machine: email.machine,
      plant: email.plant,
      area: email.area,
      subarea: email.subarea,
      station: email.station,
      machine_type: email.machine_type,
      anomaly: anomaly
    }),
  });

  if (error) {
    return Response.json({ error });
  }

  return Response.json(data);
}