import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Review = {
  id: string;
  agentId: string;
  agentName: string;
  reviewerName: string;
  ticketRef: string;
  ticketSubject: string;
  reviewedAt: string;
  overallScore: number;
  summary: string;
  criteria: { key: string; label: string; score: number; maxScore: number; comment: string }[];
  coachingItems: { id?: string; text: string; status: "open" | "done"; dueDate: string }[];
  supervisorValidatedAt?: string | null;
  supervisorRandomAuditAt?: string | null;
};

export function QaListPage() {
  const { canMutate } = useAuth();
  const query = useQuery({ queryKey: ["qa"], queryFn: () => api<{ average: number | null; reviews: Review[] }>("/api/qa") });
  return (
    <div>
      <PageHeader
        eyebrow="Quality"
        title="Reviews"
        action={canMutate("qa.create") ? <Link to="/qa/new" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">New review</Link> : null}
      />
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.data ? (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Visible average</CardTitle></CardHeader>
            <CardContent className="font-heading text-4xl">{query.data.average ?? "—"}</CardContent>
          </Card>
          {query.data.reviews.length === 0 ? <Empty title="No reviews in your view" body="QA scores appear after a reviewer files the form. Agents only see their own feedback." /> : null}
          <div className="grid gap-3">
            {query.data.reviews.map((review) => (
              <Link key={review.id} to={`/qa/${review.id}`} className="rounded-2xl border bg-card px-4 py-3 hover:border-primary">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{review.agentName} · {review.ticketRef}</p>
                    <p className="text-sm text-muted-foreground">{review.ticketSubject}</p>
                  </div>
                  <p className="font-heading text-3xl">{review.overallScore}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function QaDetailPage() {
  const { id } = useParams();
  const { canMutate, can } = useAuth();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["qa", id], queryFn: () => api<{ review: Review }>(`/api/qa/${id}`) });
  const supervisorReview = useMutation({
    mutationFn: (kind: "validation" | "random_audit") =>
      api<{ review: Review }>(`/api/qa/${id}/supervisor-review`, { method: "POST", body: JSON.stringify({ kind }) }),
    onSuccess: () => {
      toast.success("Recorded");
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const review = query.data!.review;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={review.ticketRef}
        title={review.ticketSubject}
        action={canMutate("qa.edit") ? <Link to={`/qa/${review.id}/edit`} className="text-sm text-primary">Edit</Link> : null}
      />
      {can("qa.validate") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supervisor QA oversight</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {review.supervisorValidatedAt ? (
              <p className="text-sm text-muted-foreground">Validation recorded · {new Date(review.supervisorValidatedAt).toLocaleDateString("en-IN")}</p>
            ) : (
              <Button size="sm" disabled={supervisorReview.isPending} onClick={() => supervisorReview.mutate("validation")}>
                Mark QA validation
              </Button>
            )}
            {review.supervisorRandomAuditAt ? (
              <p className="text-sm text-muted-foreground">Random audit recorded · {new Date(review.supervisorRandomAuditAt).toLocaleDateString("en-IN")}</p>
            ) : (
              <Button size="sm" variant="secondary" disabled={supervisorReview.isPending} onClick={() => supervisorReview.mutate("random_audit")}>
                Record random audit
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
      <p className="text-sm text-muted-foreground">{review.agentName} · scored by {review.reviewerName} · {new Date(review.reviewedAt).toLocaleDateString("en-IN")}</p>
      <p className="font-heading text-5xl">{review.overallScore}<span className="text-2xl text-muted-foreground">/100</span></p>
      {review.summary ? <p className="max-w-2xl text-sm">{review.summary}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {review.criteria.map((item) => (
          <Card key={item.key}>
            <CardHeader><CardTitle className="text-base">{item.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="font-heading text-3xl">{item.score}<span className="text-base text-muted-foreground">/{item.maxScore}</span></p>
              {item.comment ? <p className="mt-2 text-sm text-muted-foreground">{item.comment}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Coaching</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {review.coachingItems.length === 0 ? <p className="text-muted-foreground">No coaching items.</p> : null}
          {review.coachingItems.map((item) => (
            <p key={item.id || item.text}>{item.status === "done" ? "Done" : "Open"} · {item.text}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function QaFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const existing = useQuery({
    queryKey: ["qa", id],
    queryFn: () => api<{ review: Review }>(`/api/qa/${id}`),
    enabled: Boolean(id),
  });
  const meta = useQuery({
    queryKey: ["qa-meta"],
    queryFn: () => api<{ criteria: { key: string; label: string; maxScore: number }[] }>("/api/qa/meta"),
  });
  const people = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: { id: string; name: string; roleKey: string; qaSubject?: boolean }[] }>("/api/users"),
  });
  const review = existing.data?.review;
  const [agentId, setAgentId] = useState(review?.agentId || "");
  const [ticketRef, setTicketRef] = useState(review?.ticketRef || "");
  const [ticketSubject, setTicketSubject] = useState(review?.ticketSubject || "");
  const [summary, setSummary] = useState(review?.summary || "");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [coaching, setCoaching] = useState(review?.coachingItems.map((item) => item.text).join("\n") || "");
  useEffect(() => {
    if (!review) return;
    setAgentId(review.agentId);
    setTicketRef(review.ticketRef);
    setTicketSubject(review.ticketSubject);
    setSummary(review.summary);
    setCoaching(review.coachingItems.map((item) => item.text).join("\n"));
  }, [review]);
  const ready = meta.data && (!id || review);
  const criteria = meta.data?.criteria || [];
  const scoreFor = (key: string) => scores[key] ?? String(review?.criteria.find((item) => item.key === key)?.score ?? "");
  const commentFor = (key: string) => comments[key] ?? review?.criteria.find((item) => item.key === key)?.comment ?? "";
  const total = criteria.reduce((sum, item) => sum + (Number(scoreFor(item.key)) || 0), 0);

  const save = useMutation({
    mutationFn: () =>
      api<{ review: Review }>(id ? `/api/qa/${id}` : "/api/qa", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          agentId: agentId || review?.agentId,
          ticketRef,
          ticketSubject,
          summary,
          criteria: criteria.map((item) => ({ key: item.key, score: Number(scoreFor(item.key)) || 0, comment: commentFor(item.key) })),
          coachingItems: coaching.split("\n").map((text) => text.trim()).filter(Boolean).map((text) => ({ text, status: "open" })),
        }),
      }),
    onSuccess: (data) => {
      toast.success("Review saved");
      void client.invalidateQueries({ queryKey: ["qa"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/qa/${data.review.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (existing.isLoading || meta.isLoading || people.isLoading) return <LoadingBlock />;
  if (existing.isError || meta.isError || people.isError) return <ErrorBlock message="Could not load the review form." />;
  const agents = (people.data?.users || []).filter((user) => user.qaSubject);

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) save.mutate();
      }}
    >
      <PageHeader eyebrow="Quality" title={id ? "Edit review" : "New review"} />
      <div className="space-y-2">
        <Label>Agent</Label>
        <Select value={agentId || review?.agentId || ""} onValueChange={setAgentId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Choose an agent" /></SelectTrigger>
          <SelectContent>
            {agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2"><Label>Ticket</Label><Input value={ticketRef} onChange={(event) => setTicketRef(event.target.value)} /></div>
        <div className="space-y-2"><Label>Subject</Label><Input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} /></div>
      </div>
      {criteria.map((item) => (
        <div key={item.key} className="grid gap-2 rounded-2xl border bg-card p-3 md:grid-cols-[1fr_90px]">
          <div>
            <Label>{item.label}</Label>
            <Input className="mt-2" placeholder="Comment" value={commentFor(item.key)} onChange={(event) => setComments((current) => ({ ...current, [item.key]: event.target.value }))} />
          </div>
          <div>
            <Label>/{item.maxScore}</Label>
            <Input className="mt-2" value={scoreFor(item.key)} onChange={(event) => setScores((current) => ({ ...current, [item.key]: event.target.value }))} />
          </div>
        </div>
      ))}
      <p className="font-heading text-3xl">Score {total}/100</p>
      <div className="space-y-2">
        <Label>Summary</Label>
        <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Coaching items, one per line</Label>
        <Textarea value={coaching} onChange={(event) => setCoaching(event.target.value)} />
      </div>
      <Button type="submit" disabled={save.isPending}>Save review</Button>
    </form>
  );
}
