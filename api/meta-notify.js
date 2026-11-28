/* 메타(페이스북·인스타그램) 광고 리드 → Resend 메일 알림 전용 엔드포인트.
   구글 시트(Apps Script)에서 호출한다. Supabase 에는 저장하지 않는다
   (시트가 원장이고, 이 엔드포인트는 알림만 담당). */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, phone, unit_type, message, time_slot, source, dryRun } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: '이름과 연락처는 필수입니다.' });

  /* ── 배포·환경변수 점검용: 실제 메일 없이 설정 상태만 확인 ── */
  if (dryRun === true) {
    return res.status(200).json({ ok: true, dryRun: true, hasKey: Boolean(process.env.RESEND_API_KEY) });
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const cell = 'padding:10px 14px;border:1px solid #CBDDE8;';
  const head = 'padding:10px 14px;background:#F2F5F6;font-weight:700;border:1px solid #CBDDE8;color:#14455F;';
  const memo = esc(message) || '-';
  const sourceLine = source ? `<br><span style="color:#6E655C;font-size:12px;">유입: ${esc(source)}</span>` : '';

  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('Resend: RESEND_API_KEY 환경변수가 없습니다 (메타 리드 메일 미발송)');
      return res.status(200).json({ success: false, mail: 'no-key' });
    }
    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ['simkorea86@gmail.com'],
        subject: `[덕소역 더블뷰 한강 · 메타 광고] 새 방문예약 — ${name}`,
        html: `
          <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:520px;margin:0 auto;">
            <h2 style="color:#14455F;border-bottom:2px solid #3E8FC0;padding-bottom:10px;margin-bottom:16px;">
              덕소역 더블뷰 한강 · 메타 광고 새 방문예약이 접수되었습니다
            </h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="${head}width:30%;">현장</td>
                <td style="${cell}"><strong style="color:#3E8FC0;">덕소역 더블뷰 한강 (메타 광고)</strong></td>
              </tr>
              <tr>
                <td style="${head}">이름</td>
                <td style="${cell}">${esc(name)}</td>
              </tr>
              <tr>
                <td style="${head}">연락처</td>
                <td style="${cell}">
                  <a href="tel:${esc(phone)}" style="color:#3E8FC0;font-weight:700;">${esc(phone)}</a>
                </td>
              </tr>
              <tr>
                <td style="${head}">관심 평형</td>
                <td style="${cell}">${esc(unit_type) || '미선택'}</td>
              </tr>
              <tr>
                <td style="${head}">희망 상담시간</td>
                <td style="${cell}">${esc(time_slot) || '-'}</td>
              </tr>
              <tr>
                <td style="${head}">메모/유입</td>
                <td style="${cell}white-space:pre-wrap;">${memo}${sourceLine}</td>
              </tr>
            </table>
            <p style="margin-top:20px;color:#6E655C;font-size:12px;">
              덕소역 더블뷰 한강 안내 ·
              <a href="https://deokso-doubleview.vercel.app" style="color:#3E8FC0;">홈페이지 바로가기</a>
            </p>
          </div>
        `
      })
    });
    if (!mailRes.ok) {
      const errText = await mailRes.text();
      console.error('Resend 발송 실패:', mailRes.status, errText);
      return res.status(200).json({ success: false, mail: 'failed', status: mailRes.status });
    }
    const data = await mailRes.json().catch(() => ({}));
    return res.status(200).json({ success: true, mail: 'sent', id: data.id });
  } catch (e) {
    console.error('Resend 호출 예외:', e && e.message);
    return res.status(200).json({ success: false, mail: 'error' });
  }
};
