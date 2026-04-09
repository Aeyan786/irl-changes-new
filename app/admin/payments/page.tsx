"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search, DollarSign, XCircle, Clock, CheckCircle, ShieldCheck,
  Loader2, RotateCcw, AlertCircle,
  Eye,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { verifyPayment, processRefundRequest } from "@/app/actions/payments"
import Loading from "./loading"

interface Payment {
  id: string
  registration_id: string
  amount: number
  stripe_id: string | null
  status: "pending" | "paid" | "failed" | "refunded"
  created_at: string
  registration?: {
    id: string; team_id: string; race_id: string; runners: string[]
    team?: { id: string; name: string; manager?: { id: string; first_name: string | null; last_name: string | null; email: string } }
    race?: { id: string; title: string; date: string }
  }
}

interface RefundRequest {
  id: string
  payment_id: string
  registration_id: string
  reason: string
  status: "pending" | "approved" | "rejected"
  admin_note: string | null
  created_at: string
  payment?: { id: string; amount: number; stripe_id: string | null }
  manager?: { id: string; first_name: string | null; last_name: string | null; email: string }
  team?: { id: string; name: string }
  registration?: { id: string; race?: { id: string; title: string } }
}

interface Race { id: string; title: string }
interface Team { id: string; name: string }

export default function AdminPaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<Payment[]>([])
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [confirmPayment, setConfirmPayment] = useState<Payment | null>(null)

  // Refund processing
  const [processingRefund, setProcessingRefund] = useState<string | null>(null)
  const [refundActionDialog, setRefundActionDialog] = useState<{ request: RefundRequest; action: "approve" | "reject" } | null>(null)
  const [adminNote, setAdminNote] = useState("")

  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")
  const [raceFilter, setRaceFilter] = useState<string>("all")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewResaon,setViewReason] = useState(false)


  useEffect(() => { fetchData() }, [])
  useEffect(() => { setSearchQuery(searchParams.get("q") ?? "") }, [searchParams])

  const fetchData = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: paymentsData } = await supabase
      .from("payments")
      .select(`
        *,
        registration:registrations(
          id, team_id, race_id, runners,
          team:teams(id, name, manager:users!teams_manager_id_fkey(id, first_name, last_name, email)),
          race:races(id, title, date)
        )
      `)
      .order("created_at", { ascending: false })

    const { data: refundData } = await supabase
      .from("refund_requests")
      .select(`
        *,
        payment:payments(id, amount, stripe_id),
        manager:users!refund_requests_manager_id_fkey(id, first_name, last_name, email),
        team:teams(id, name),
        registration:registrations(id, race:races(id, title))
      `)
      .order("created_at", { ascending: false })

    const { data: racesData } = await supabase.from("races").select("id, title").order("title")
    const { data: teamsData } = await supabase.from("teams").select("id, name").order("name")

    setPayments(paymentsData || [])
    setRefundRequests(refundData || [])
    setRaces(racesData || [])
    setTeams(teamsData || [])
    setLoading(false)
  }

  const handleVerifyPayment = async (payment: Payment) => {
    setVerifyingId(payment.id)
    const result = await verifyPayment(payment.id, payment.registration_id)
    setVerifyingId(null)
    setConfirmPayment(null)
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Payment Verified", description: `Payment verified. An invoice has been sent to the manager.` })
      setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status: "paid" } : p))
    }
  }

  const handleProcessRefund = async () => {
    if (!refundActionDialog) return
    const { request, action } = refundActionDialog
    setProcessingRefund(request.id)

    const result = await processRefundRequest(request.id, action, adminNote)

    setProcessingRefund(null)
    setRefundActionDialog(null)
    setAdminNote("")

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    } else {
      toast({
        title: action === "approve" ? "Refund Approved" : "Refund Rejected",
        description: action === "approve"
          ? "The refund has been processed and the team removed from the race."
          : "The refund request has been rejected.",
      })
      await fetchData()
    }
  }

  const totalCollected = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0)
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0)
  const totalFailed = payments.filter(p => p.status === "failed").reduce((s, p) => s + (p.amount || 0), 0)
  const pendingRefunds = refundRequests.filter(r => r.status === "pending").length

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const teamName = payment.registration?.team?.name?.toLowerCase() || ""
      const managerName = `${payment.registration?.team?.manager?.first_name || ""} ${payment.registration?.team?.manager?.last_name || ""}`.toLowerCase()
      const raceName = payment.registration?.race?.title?.toLowerCase() || ""
      const matchesSearch = searchQuery === "" || teamName.includes(searchQuery.toLowerCase()) || managerName.includes(searchQuery.toLowerCase()) || raceName.includes(searchQuery.toLowerCase())
      const matchesRace = raceFilter === "all" || payment.registration?.race_id === raceFilter
      const matchesTeam = teamFilter === "all" || payment.registration?.team_id === teamFilter
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter
      return matchesSearch && matchesRace && matchesTeam && matchesStatus
    })
  }, [payments, searchQuery, raceFilter, teamFilter, statusFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>
      case "pending": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
      case "failed": return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>
      case "refunded": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><RotateCcw className="mr-1 h-3 w-3" />Refunded</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRefundStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
      case "approved": return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>
      case "rejected": return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)

  if (loading) return <Loading />


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground">Track and manage all payment transactions</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-500/10 p-3"><DollarSign className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
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
              <div className="rounded-full bg-red-500/10 p-3"><XCircle className="h-6 w-6 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalFailed)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-orange-500/10 p-3"><RotateCcw className="h-6 w-6 text-orange-500" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Refund Requests</p>
                <p className="text-2xl font-bold text-orange-500">{pendingRefunds}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      {/* <Tabs defaultValue={ "payments"}>
        <TabsList>
          <TabsTrigger value="payments">All Payments</TabsTrigger>
          <TabsTrigger value="refunds" className="relative">
            Refund Requests
            {pendingRefunds > 0 && (
              <span className="ml-2 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 font-bold">
                {pendingRefunds}
              </span>
            )}
          </TabsTrigger>
        </TabsList> */}

        {/* Payments Tab */}
        {/* <TabsContent value="payments"> */}
          <Card>
            <CardHeader>
              <CardTitle>All Payments</CardTitle>
              <CardDescription>{filteredPayments.length} of {payments.length} payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-4 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by team, manager, or race..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={raceFilter} onValueChange={setRaceFilter}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Filter by race" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Races</SelectItem>
                      {races.map(race => <SelectItem key={race.id} value={race.id}>{race.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Filter by team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {teams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
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

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="hidden md:table-cell">Manager</TableHead>
                      <TableHead>Race</TableHead>
                      <TableHead className="hidden sm:table-cell">Runners</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No payments found</TableCell>
                      </TableRow>
                    ) : filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.registration?.team?.name || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {payment.registration?.team?.manager ? (
                            <div>
                              <p className="text-sm">{payment.registration.team.manager.first_name} {payment.registration.team.manager.last_name}</p>
                              <p className="text-xs text-muted-foreground">{payment.registration.team.manager.email}</p>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{payment.registration?.race?.title || "-"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{payment.registration?.runners?.length || 0}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(payment.amount || 0)}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {payment.status === "pending" ? (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white cursor-pointer gap-1"
                              disabled={verifyingId === payment.id}
                              onClick={() => setConfirmPayment(payment)}
                            >
                              {verifyingId === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                              Verify
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        {/* </TabsContent> */}

        {/* Refund Requests Tab */}
        {/* <TabsContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle>Refund Requests</CardTitle>
              <CardDescription>
                {pendingRefunds} pending · {refundRequests.length} total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="hidden md:table-cell">Manager</TableHead>
                      <TableHead>Race</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          No refund requests yet
                        </TableCell>
                      </TableRow>
                    ) : refundRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.team?.name || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {req.manager ? (
                            <div>
                              <p className="text-sm">{req.manager.first_name} {req.manager.last_name}</p>
                              <p className="text-xs text-muted-foreground">{req.manager.email}</p>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{(req.registration as any)?.race?.title || "-"}</TableCell>
                        <TableCell className="font-medium">{formatCurrency((req.payment as any)?.amount || 0)}</TableCell>
                        <TableCell>{getRefundStatusBadge(req.status)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{new Date(req.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {req.status === "pending" ? (
                            <div className="flex items-center gap-2">
                                <Button
                                size="sm"
                                variant={'ghost'}
                                className=" cursor-pointer gap-1"
                                disabled={processingRefund === req.id}
                                onClick={() =>setViewReason(true)}
                              >
                                <Eye className="h-3 w-3" />
                                
                              </Button>
                              <Dialog open={viewResaon} onOpenChange={setViewReason}>
                                <DialogContent>
                                  <DialogTitle>Refund Reason</DialogTitle>
                                  <span className="text-sm text-muted-foreground">{req?.reason}</span>
                                </DialogContent>
                              </Dialog>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 cursor-pointer text-white gap-1"
                                disabled={processingRefund === req.id}
                                onClick={() => { setRefundActionDialog({ request: req, action: "approve" }); setAdminNote("") }}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 gap-1 cursor-pointer"
                                disabled={processingRefund === req.id}
                                onClick={() => { setRefundActionDialog({ request: req, action: "reject" }); setAdminNote("") }}
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {req.admin_note ? (
                                <span title={req.admin_note} className="cursor-help underline decoration-dotted">
                                  Note added
                                </span>
                              ) : "—"}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent> */}
      {/* </Tabs> */}

      {/* Verify Payment Dialog */}
      <AlertDialog open={!!confirmPayment} onOpenChange={(open) => !open && setConfirmPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Verify Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that <strong>{confirmPayment?.registration?.team?.name}</strong> has paid{" "}
              <strong>{formatCurrency(confirmPayment?.amount || 0)}</strong> for the{" "}
              <strong>{confirmPayment?.registration?.race?.title}</strong> race.
              <br /><br />
              This will mark the payment as <strong>Paid</strong> and automatically send an invoice receipt to the manager.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 cursor-pointer"
              onClick={() => confirmPayment && handleVerifyPayment(confirmPayment)}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Yes, Verify & Send Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refund Action Dialog */}
      {/* <Dialog open={!!refundActionDialog} onOpenChange={(open) => { if (!open) { setRefundActionDialog(null); setAdminNote("") } }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${refundActionDialog?.action === "approve" ? "text-green-700" : "text-red-700"}`}>
              {refundActionDialog?.action === "approve"
                ? <><CheckCircle className="h-5 w-5" /> Approve Refund</>
                : <><XCircle className="h-5 w-5" /> Reject Refund</>
              }
            </DialogTitle>
            <DialogDescription>
              {refundActionDialog?.action === "approve"
                ? `This will issue a refund of ${formatCurrency((refundActionDialog?.request?.payment as any)?.amount || 0)} and remove ${refundActionDialog?.request?.team?.name} from the race.`
                : `The manager will be notified that their refund request has been rejected.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Team</span>
                <span className="font-medium">{refundActionDialog?.request?.team?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Race</span>
                <span className="font-medium">{(refundActionDialog?.request?.registration as any)?.race?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatCurrency((refundActionDialog?.request?.payment as any)?.amount || 0)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Reason submitted by manager:</p>
              <p className="text-sm bg-muted rounded-md p-3 italic">"{refundActionDialog?.request?.reason}"</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Admin note (optional)</label>
              <Textarea
                placeholder="Add a note to the manager..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRefundActionDialog(null); setAdminNote("") }}>
              Cancel
            </Button>
            <Button
              disabled={processingRefund === refundActionDialog?.request?.id}
              className={refundActionDialog?.action === "approve"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
              }
              onClick={handleProcessRefund}
            >
              {processingRefund === refundActionDialog?.request?.id
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : refundActionDialog?.action === "approve"
                  ? <CheckCircle className="mr-2 h-4 w-4" />
                  : <XCircle className="mr-2 h-4 w-4" />
              }
              {refundActionDialog?.action === "approve" ? "Approve & Refund" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
    </div>
  )
}
