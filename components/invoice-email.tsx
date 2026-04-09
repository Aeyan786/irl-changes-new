import * as React from "react"

interface InvoiceEmailProps {
  managerName: string
  teamName: string
  raceName: string
  raceDate: string
  raceVenue: string
  runnerCount: number
  amount: number
  paymentId: string
  paidAt: string
}

export function InvoiceEmail({
  managerName,
  teamName,
  raceName,
  raceDate,
  raceVenue,
  runnerCount,
  amount,
  paymentId,
  paidAt,
}: InvoiceEmailProps) {
  const pricePerRunner = 10
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)

  const formattedDate = new Date(paidAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const formattedRaceDate = new Date(raceDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const receiptNo = `IRL-${paymentId.slice(0, 8).toUpperCase()}`

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment Receipt – Infinite Running League</title>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: "#f1f1f1",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#f1f1f1", padding: "40px 16px" }}>
          <tr>
            <td align="center">
              <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: "580px" }}>

                {/* ── HEADER ── */}
                <tr>
                  <td style={{
                    backgroundColor: "#CC0000",
                    borderRadius: "12px 12px 0 0",
                    padding: "28px 40px",
                  }}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td style={{ verticalAlign: "middle" }}>
                          {/* Logo box + wordmark */}
                          <table cellPadding={0} cellSpacing={0}>
                            <tr>
                              <td style={{ verticalAlign: "middle" }}>
                                <div style={{
                                  backgroundColor: "#ffffff",
                                  borderRadius: "8px",
                                  width: "44px",
                                  height: "44px",
                                  display: "inline-block",
                                  textAlign: "center",
                                  lineHeight: "44px",
                                  verticalAlign: "middle",
                                }}>
                                  <img
                                    src="https://irl-new-eosin.vercel.app/white_red_irl_fav_icon__1_-removebg-preview.png"
                                    alt="IRL"
                                    width="32"
                                    height="32"
                                    style={{ display: "inline-block", verticalAlign: "middle" }}
                                  />
                                </div>
                              </td>
                              <td style={{ paddingLeft: "12px", verticalAlign: "middle" }}>
                                <p style={{ margin: 0, color: "#ffffff", fontSize: "18px", fontWeight: "bold", letterSpacing: "0.5px" }}>
                                  Infinite Running League
                                </p>
                                <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.75)", fontSize: "12px", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                                  Official Receipt
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="right" style={{ verticalAlign: "middle" }}>
                          <div style={{
                            backgroundColor: "rgba(255,255,255,0.15)",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            display: "inline-block",
                          }}>
                            <p style={{ margin: 0, color: "#ffffff", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>Receipt No.</p>
                            <p style={{ margin: "2px 0 0", color: "#ffffff", fontSize: "13px", fontWeight: "bold", fontFamily: "monospace" }}>{receiptNo}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* ── RED ACCENT STRIP ── */}
                <tr>
                  <td style={{ height: "4px", backgroundColor: "#aa0000" }} />
                </tr>

                {/* ── BODY ── */}
                <tr>
                  <td style={{
                    backgroundColor: "#ffffff",
                    padding: "36px 40px 0",
                  }}>
                    {/* Greeting */}
                    <p style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: "bold", color: "#111827" }}>
                      Payment Confirmed! 🎉
                    </p>
                    <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#6b7280", lineHeight: "1.6" }}>
                      Hi <strong style={{ color: "#111827" }}>{managerName}</strong>, your payment has been verified by the admin.
                      Here's your official receipt — keep it for your records.
                    </p>

                    {/* Amount hero box */}
                    <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: "28px" }}>
                      <tr>
                        <td style={{
                          background: "linear-gradient(135deg, #CC0000 0%, #ff3333 100%)",
                          borderRadius: "10px",
                          padding: "24px",
                          textAlign: "center",
                        }}>
                          <p style={{ margin: "0 0 4px", fontSize: "12px", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "bold" }}>
                            Amount Paid
                          </p>
                          <p style={{ margin: "0 0 4px", fontSize: "42px", fontWeight: "bold", color: "#ffffff", lineHeight: 1 }}>
                            {formattedAmount}
                          </p>
                          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.75)" }}>
                            {runnerCount} runner{runnerCount !== 1 ? "s" : ""} × ${pricePerRunner}.00 each
                          </p>
                        </td>
                      </tr>
                    </table>

                    {/* Race info card */}
                    <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: "24px" }}>
                      <tr>
                        <td style={{
                          backgroundColor: "#fff5f5",
                          border: "1px solid #fecaca",
                          borderLeft: "4px solid #CC0000",
                          borderRadius: "0 8px 8px 0",
                          padding: "16px 20px",
                        }}>
                          <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#CC0000", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>
                            Race Details
                          </p>
                          <p style={{ margin: "0 0 2px", fontSize: "17px", fontWeight: "bold", color: "#111827" }}>
                            {raceName}
                          </p>
                          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                            📅 {formattedRaceDate} &nbsp;·&nbsp; 📍 {raceVenue || "TBD"}
                          </p>
                        </td>
                      </tr>
                    </table>

                    {/* Details table */}
                    <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: "28px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e7eb" }}>
                      {[
                        { label: "Team", value: teamName },
                        { label: "Runners Registered", value: `${runnerCount} runner${runnerCount !== 1 ? "s" : ""}` },
                        { label: "Price per Runner", value: `$${pricePerRunner}.00` },
                        { label: "Payment Date", value: formattedDate },
                        { label: "Receipt No.", value: receiptNo },
                      ].map((row, i) => (
                        <tr key={row.label} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                          <td style={{
                            padding: "11px 16px",
                            fontSize: "13px",
                            color: "#6b7280",
                            borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                            width: "40%",
                          }}>
                            {row.label}
                          </td>
                          <td style={{
                            padding: "11px 16px",
                            fontSize: "13px",
                            color: "#111827",
                            fontWeight: "600",
                            borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                          }}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr style={{ backgroundColor: "#fff5f5" }}>
                        <td style={{
                          padding: "14px 16px",
                          fontSize: "15px",
                          fontWeight: "bold",
                          color: "#CC0000",
                          borderTop: "2px solid #fecaca",
                        }}>
                          Total Paid
                        </td>
                        <td style={{
                          padding: "14px 16px",
                          fontSize: "15px",
                          fontWeight: "bold",
                          color: "#CC0000",
                          borderTop: "2px solid #fecaca",
                        }}>
                          {formattedAmount}
                        </td>
                      </tr>
                    </table>

                    {/* Confirmation message */}
                    <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: "32px" }}>
                      <tr>
                        <td style={{
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: "8px",
                          padding: "14px 18px",
                        }}>
                          <p style={{ margin: 0, fontSize: "14px", color: "#15803d", lineHeight: "1.6" }}>
                            ✅ <strong>Your team's registration is fully confirmed.</strong> We look forward to seeing <strong>{teamName}</strong> at the race!
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* ── FOOTER ── */}
                <tr>
                  <td style={{
                    backgroundColor: "#1a1a1a",
                    borderRadius: "0 0 12px 12px",
                    padding: "24px 40px",
                    textAlign: "center",
                  }}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td align="center" style={{ paddingBottom: "12px" }}>
                          <div style={{
                            width: "28px",
                            height: "28px",
                            backgroundColor: "#CC0000",
                            borderRadius: "6px",
                            display: "inline-block",
                            textAlign: "center",
                            lineHeight: "28px",
                            marginBottom: "6px",
                          }}>
                            <img
                              src="https://irl-new-eosin.vercel.app/white_red_irl_fav_icon__1_-removebg-preview.png"
                              alt="IRL"
                              width="18"
                              height="18"
                              style={{ display: "inline-block", verticalAlign: "middle" }}
                            />
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: "bold", color: "#ffffff" }}>
                            Infinite Running League
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center">
                          <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#6b7280" }}>
                            Questions? Email us at{" "}
                            <a href="mailto:support@saatish.com" style={{ color: "#CC0000", textDecoration: "none" }}>
                              support@saatish.com
                            </a>
                          </p>
                          <p style={{ margin: 0, fontSize: "11px", color: "#4b5563" }}>
                            © {new Date().getFullYear()} Infinite Running League · This is an automated receipt, please do not reply.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}
