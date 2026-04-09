"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import {
  Search, Clock, CheckCircle, XCircle, ExternalLink, CreditCard,
  Receipt, TrendingUp, ArrowUpRight, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react"
import { submitRefundRequest } from "@/app/actions/payments"

interface Payment {
  id: string
  registration_id: string
  amount: number
  stripe_id: string | null
  status: "pending" | "paid" | "failed" | "refunded"
  created_at: string
  registration?: {
    id: string
    team_id: string
    race_id: string
    runners: string[]
    sub_team_type: string
    team?: { id: string; name: string }
    race?: { id: string; title: string; date: string; venue: string }
  }
}

interface Race { id: string; title: string }

const ITEMS_PER_PAGE = 10

export default function ManagerPaymentsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<Payment[]>([])
  const [races, setRaces] = useState<Race[]>([])

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [raceFilter, setRaceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Pay dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [pendingRegistrations, setPendingRegistrations] = useState<Array<{
    id: string; team_name: string; race_title: string; race_date: string; amount: number
  }>>([])
  const [payDialogLoading, setPayDialogLoading] = useState(false)

  // Detail dialog
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // Refund dialog
  const [refundPayment, setRefundPayment] = useState<Payment | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false)
  const [submittingRefund, setSubmittingRefund] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: teams } = await supabase
      .from("teams").select("id").eq("manager_id", user.id)
    const teamIds = teams?.map(t => t.id) || []
    if (teamIds.length === 0) { setLoading(false); return }

    const { data: registrations } = await supabase
      .from("registrations").select("id").in("team_id", teamIds)
    const registrationIds = registrations?.map(r => r.id) || []
    if (registrationIds.length === 0) { setLoading(false); return }

    const { data: paymentsData } = await supabase
      .from("payments")
      .select(`
        *,
        registration:registrations(
          id, team_id, race_id, runners, sub_team_type,
          team:teams(id, name),
          race:races(id, title, date, venue)
        )
      `)
      .in("registration_id", registrationIds)
      .order("created_at", { ascending: false })

    const { data: racesData } = await supabase.from("races").select("id, title").order("title")

    setPayments(paymentsData || [])
    setRaces(racesData || [])
    setLoading(false)
  }

  const openPayDialog = async () => {
    setPayDialogOpen(true)
    setPayDialogLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPayDialogLoading(false); return }

    const { data: teams } = await supabase
      .from("teams").select("id, name").eq("manager_id", user.id)
    if (!teams || teams.length === 0) { setPendingRegistrations([]); setPayDialogLoading(false); return }

    const teamIds = teams.map(t => t.id)
    const { data: regs } = await supabase
      .from("registrations")
      .select(`id, team_id, payment_status, runners, race:races(id, title, date)`)
      .in("team_id", teamIds)
      .in("payment_status", ["pending", "unpaid"])

    const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]))
    const pending = (regs || []).map(r => {
      const race = r.race as unknown as { id: string; title: string; date: string } | null
      const runnerCount = Array.isArray(r.runners) ? r.runners.length : 1
      return {
        id: r.id,
        team_name: teamMap[r.team_id] || "Unknown",
        race_title: race?.title || "Unknown Race",
        race_date: race?.date || "",
        amount: runnerCount * 10,
      }
    })
    setPendingRegistrations(pending)
    setPayDialogLoading(false)
  }

  const handleRefundSubmit = async () => {
    if (!refundPayment || !refundReason.trim()) return
    setSubmittingRefund(true)

    const result = await submitRefundRequest(
      refundPayment.id,
      refundPayment.registration_id,
      refundPayment.registration?.team?.id || "",
      refundReason.trim()
    )

    setSubmittingRefund(false)
    setRefundConfirmOpen(false)
    setRefundDialogOpen(false)
    setRefundReason("")
    setRefundPayment(null)

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Refund Requested", description: "Your refund request has been submitted. The admin will review it shortly." })
    }
  }

  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0)
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0)

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const teamName = payment.registration?.team?.name?.toLowerCase() || ""
      const raceName = payment.registration?.race?.title?.toLowerCase() || ""
      const matchesSearch = searchQuery === "" || teamName.includes(searchQuery.toLowerCase()) || raceName.includes(searchQuery.toLowerCase())
      const matchesRace = raceFilter === "all" || payment.registration?.race_id === raceFilter
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter
      return matchesSearch && matchesRace && matchesStatus
    })
  }, [payments, searchQuery, raceFilter, statusFilter])

  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE)
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
      case "failed":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>
      case "refunded":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><RotateCcw className="mr-1 h-3 w-3" />Refunded</Badge>
      default:
        return <Badge variant="outline"><AlertCircle className="mr-1 h-3 w-3" />Unknown</Badge>
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">Track payments for your team registrations</p>
        </div>
        <Button onClick={openPayDialog} className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer">
          <CreditCard className="mr-2 h-4 w-4" />Pay
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-500/10 p-3"><CheckCircle className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-yellow-500/10 p-3"><Clock className="h-6 w-6 text-yellow-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-muted p-3"><TrendingUp className="h-6 w-6 text-muted-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{payments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>{filteredPayments.length} of {payments.length} payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by team or race..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={raceFilter} onValueChange={(v) => { setRaceFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Filter by race" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Races</SelectItem>
                  {races.map(race => <SelectItem key={race.id} value={race.id}>{race.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4"><CreditCard className="h-8 w-8 text-muted-foreground" /></div>
              <h3 className="text-lg font-semibold mb-2">No payments yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">Register your teams for races to see payment records here.</p>
              <Button className="bg-[#FF0000] hover:bg-red-600 hover:shadow-lg cursor-pointer" asChild>
                <Link href="/manager/races">Browse Races <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Race</TableHead>
                      <TableHead className="hidden md:table-cell">Team</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No payments match your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{payment.registration?.race?.title || "Unknown Race"}</p>
                              <p className="text-sm text-muted-foreground md:hidden">{payment.registration?.team?.name || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{payment.registration?.team?.name || "-"}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(payment.amount || 0)}</TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell">{formatDate(payment.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {payment.status === "pending" && (
                                <Button size="sm" variant="accent" asChild>
                                  <Link href={`/checkout/${payment.registration_id}`}>Pay Now</Link>
                                </Button>
                              )}
                              {payment.status === "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                  onClick={() => {
                                    setRefundPayment(payment)
                                    setRefundDialogOpen(true)
                                  }}
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Refund
                                </Button>
                              )}
                              {payment.status === "paid" && payment.stripe_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`https://dashboard.stripe.com/payments/${payment.stripe_id}`, "_blank")}
                                >
                                  <Receipt className="mr-1 h-3 w-3" />
                                  Receipt
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedPayment(payment); setDetailDialogOpen(true) }}>
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredPayments.length)} of {filteredPayments.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pending Payments</DialogTitle>
            <DialogDescription>Select a registration to pay</DialogDescription>
          </DialogHeader>
          {payDialogLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : pendingRegistrations.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="rounded-full bg-green-500/10 p-4 mb-4"><CheckCircle className="h-8 w-8 text-green-600" /></div>
              <p className="font-medium text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending payments at this time.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {pendingRegistrations.map(reg => (
                <div key={reg.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-accent/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{reg.race_title}</p>
                    <p className="text-sm text-muted-foreground">{reg.team_name}</p>
                    {reg.race_date && <p className="text-xs text-muted-foreground">{formatDate(reg.race_date)}</p>}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-bold text-foreground">{formatCurrency(reg.amount)}</span>
                    <Button size="sm" className="bg-accent hover:bg-accent/90 text-white" asChild>
                      <Link href={`/checkout/${reg.id}`}>Pay</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Request Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={(open) => { setRefundDialogOpen(open); if (!open) { setRefundReason(""); setRefundPayment(null) } }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              Request Refund
            </DialogTitle>
            <DialogDescription>
              Submit a refund request for <strong>{refundPayment?.registration?.race?.title}</strong>.
              The admin will review and process your request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Team</span>
                <span className="font-medium">{refundPayment?.registration?.team?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Race</span>
                <span className="font-medium">{refundPayment?.registration?.race?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-orange-600">{formatCurrency(refundPayment?.amount || 0)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for refund <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="Please explain why you are requesting a refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              ⚠️ If approved, your team will be <strong>removed from the race</strong> and the amount will be refunded.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRefundDialogOpen(false); setRefundReason(""); setRefundPayment(null) }}>
              Cancel
            </Button>
            <Button
              disabled={!refundReason.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => { setRefundDialogOpen(false); setRefundConfirmOpen(true) }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirm Alert */}
      <AlertDialog open={refundConfirmOpen} onOpenChange={setRefundConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Refund Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to request a refund of{" "}
              <strong>{formatCurrency(refundPayment?.amount || 0)}</strong> for{" "}
              <strong>{refundPayment?.registration?.race?.title}</strong>?
              If approved, your team will be removed from the race.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRefundConfirmOpen(false); setRefundDialogOpen(true) }}>
              Back
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600"
              disabled={submittingRefund}
              onClick={handleRefundSubmit}
            >
              {submittingRefund ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Yes, Submit Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>Transaction information</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(selectedPayment.amount || 0)}</p>
                </div>
                {getStatusBadge(selectedPayment.status)}
              </div>
              <div className="space-y-3">
                {[
                  { label: "Race", value: selectedPayment.registration?.race?.title || "Unknown" },
                  { label: "Team", value: selectedPayment.registration?.team?.name || "Unknown" },
                  { label: "Category", value: selectedPayment.registration?.sub_team_type?.replace("-", " ") || "-" },
                  { label: "Runners", value: `${selectedPayment.registration?.runners?.length || 0} registered` },
                  { label: "Payment Date", value: formatDate(selectedPayment.created_at) },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="font-medium capitalize">{item.value}</p>
                  </div>
                ))}
                {selectedPayment.stripe_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-mono text-sm">{selectedPayment.stripe_id}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                {selectedPayment.status === "pending" && (
                  <Button variant="accent" className="flex-1" asChild>
                    <Link href={`/checkout/${selectedPayment.registration_id}`}>
                      <CreditCard className="mr-2 h-4 w-4" />Pay Now
                    </Link>
                  </Button>
                )}
                {selectedPayment.status === "paid" && selectedPayment.stripe_id && (
                  <Button variant="outline" className="flex-1 bg-transparent"
                    onClick={() => window.open(`https://dashboard.stripe.com/payments/${selectedPayment.stripe_id}`, "_blank")}>
                    <ExternalLink className="mr-2 h-4 w-4" />View in Stripe
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
