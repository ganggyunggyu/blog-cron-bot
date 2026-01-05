import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Database, Filter, Link2, Play } from 'lucide-react';
import { cn, Badge, Button, Card, Input, Label, Toggle } from '@/shared';
import { requestBatchRun } from '@/features/batch-runner/api/batch-runner.api';
import { useApiBase } from '@/shared/hooks/use-api-base';

export const BatchPanel = () => {
  const { normalizedBase } = useApiBase();
  const [startIndex, setStartIndex] = React.useState(0);
  const [limit, setLimit] = React.useState(5);
  const [onlySheetType, setOnlySheetType] = React.useState('');
  const [onlyCompany, setOnlyCompany] = React.useState('');
  const [onlyKeywordRegex, setOnlyKeywordRegex] = React.useState('');
  const [onlyId, setOnlyId] = React.useState('');
  const [onlyIds, setOnlyIds] = React.useState('');
  const [allowAnyBlog, setAllowAnyBlog] = React.useState(false);
  const [maxContentChecks, setMaxContentChecks] = React.useState(3);
  const [contentCheckDelay, setContentCheckDelay] = React.useState(600);

  const mutation = useMutation({
    mutationFn: () => {
      const onlyIdsList = onlyIds
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      return requestBatchRun(normalizedBase, {
        startIndex,
        limit,
        onlySheetType,
        onlyCompany,
        onlyKeywordRegex,
        onlyId,
        onlyIds: onlyIdsList,
        allowAnyBlog,
        maxContentChecks,
        contentCheckDelay,
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  const result = mutation.data;
  const processed = result?.processed ?? [];

  return (
    <Card className={cn('p-8')}> 
      <div className={cn('flex flex-col gap-6')}>
        <div className={cn('flex items-center justify-between')}>
          <div className={cn('flex items-center gap-3')}>
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--accent-2)]'
              )}
            >
              <Database size={18} />
            </div>
            <div>
              <h2 className={cn('text-lg font-semibold text-[var(--ink-1)]')}>
                Batch Runner
              </h2>
              <p className={cn('text-sm text-[var(--ink-2)]')}>
                Run a short batch to validate keywords with DB writes.
              </p>
            </div>
          </div>
          <Badge variant={result?.ok ? 'success' : 'neutral'}>
            {result?.ok ? 'Batch Complete' : 'Awaiting Run'}
          </Badge>
        </div>

        <form
          onSubmit={handleSubmit}
          className={cn('grid gap-5 rounded-3xl border border-[var(--border)] bg-white/60 p-6')}
        >
          <div className={cn('grid gap-4 md:grid-cols-2')}> 
            <div className={cn('grid gap-2')}>
              <Label htmlFor="start">Start index</Label>
              <Input
                id="start"
                type="number"
                min={0}
                value={startIndex}
                onChange={(event) => setStartIndex(Number(event.target.value))}
                startIcon={<Play size={16} />}
              />
            </div>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                startIcon={<Filter size={16} />}
              />
            </div>
          </div>

          <div className={cn('grid gap-4 md:grid-cols-2')}>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="sheet">Only sheet type</Label>
              <Input
                id="sheet"
                value={onlySheetType}
                onChange={(event) => setOnlySheetType(event.target.value)}
                placeholder="package"
              />
            </div>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="company">Only company</Label>
              <Input
                id="company"
                value={onlyCompany}
                onChange={(event) => setOnlyCompany(event.target.value)}
                placeholder="Company name"
              />
            </div>
          </div>

          <div className={cn('grid gap-4 md:grid-cols-2')}>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="regex">Keyword regex</Label>
              <Input
                id="regex"
                value={onlyKeywordRegex}
                onChange={(event) => setOnlyKeywordRegex(event.target.value)}
                placeholder="Optional regex"
              />
            </div>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="onlyId">Only ID</Label>
              <Input
                id="onlyId"
                value={onlyId}
                onChange={(event) => setOnlyId(event.target.value)}
                placeholder="Single document ID"
                startIcon={<Link2 size={16} />}
              />
            </div>
          </div>

          <div className={cn('grid gap-4 md:grid-cols-2')}>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="onlyIds" hint="Comma or space separated IDs">
                Only IDs
              </Label>
              <Input
                id="onlyIds"
                value={onlyIds}
                onChange={(event) => setOnlyIds(event.target.value)}
                placeholder="id1, id2, id3"
              />
            </div>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="delay">Delay per check (ms)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                value={contentCheckDelay}
                onChange={(event) => setContentCheckDelay(Number(event.target.value))}
              />
            </div>
          </div>

          <div className={cn('grid gap-4 md:grid-cols-2')}>
            <div className={cn('grid gap-2')}>
              <Label htmlFor="maxChecks">Max content checks</Label>
              <Input
                id="maxChecks"
                type="number"
                min={1}
                value={maxContentChecks}
                onChange={(event) => setMaxContentChecks(Number(event.target.value))}
              />
            </div>
            <Toggle
              label="Allow any blog"
              description="Skip blog whitelist filtering."
              checked={allowAnyBlog}
              onChange={(event) => setAllowAnyBlog(event.target.checked)}
            />
          </div>

          <div className={cn('flex items-center gap-3')}> 
            <Button type="submit" isLoading={mutation.isPending}>
              Run Batch
            </Button>
            <span className={cn('text-xs text-[var(--ink-2)]')}>
              Last run: {processed.length} items
            </span>
          </div>
        </form>

        {mutation.error ? (
          <div
            className={cn(
              'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600'
            )}
          >
            {(mutation.error as Error).message}
          </div>
        ) : null}

        {result ? (
          <div className={cn('overflow-hidden rounded-3xl border border-[var(--border)]')}>
            <div
              className={cn(
                'flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4'
              )}
            >
              <div className={cn('text-sm font-semibold')}>Batch Results</div>
              <Badge variant={result.ok ? 'success' : 'danger'}>
                {result.ok ? 'Complete' : 'Failed'}
              </Badge>
            </div>
            <div className={cn('max-h-[360px] overflow-auto')}> 
              <table className={cn('w-full text-left text-sm')}> 
                <thead className={cn('bg-white/60 text-xs text-[var(--ink-2)]')}>
                  <tr>
                    <th className={cn('px-4 py-3')}>#</th>
                    <th className={cn('px-4 py-3')}>Status</th>
                    <th className={cn('px-4 py-3')}>Keyword</th>
                    <th className={cn('px-4 py-3')}>Restaurant</th>
                    <th className={cn('px-4 py-3')}>Topic</th>
                    <th className={cn('px-4 py-3')}>Rank</th>
                    <th className={cn('px-4 py-3')}>Vendor</th>
                    <th className={cn('px-4 py-3')}>Blog</th>
                    <th className={cn('px-4 py-3')}>Title</th>
                    <th className={cn('px-4 py-3')}>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((item, index) => (
                    <tr
                      key={`${item.postLink}-${index}`}
                      className={cn('border-t border-[var(--border)]')}
                    >
                      <td className={cn('px-4 py-3 text-[var(--ink-2)]')}>
                        {index + 1}
                      </td>
                      <td className={cn('px-4 py-3')}>
                        <Badge variant={item.ok ? 'success' : 'danger'}>
                          {item.ok ? 'OK' : item.reason || 'Fail'}
                        </Badge>
                      </td>
                      <td className={cn('px-4 py-3')}>{item.keyword}</td>
                      <td className={cn('px-4 py-3')}>{item.restaurantName || '-'}</td>
                      <td className={cn('px-4 py-3')}>{item.topic || '-'}</td>
                      <td className={cn('px-4 py-3')}>{item.rank ?? '-'}</td>
                      <td className={cn('px-4 py-3')}>{item.postVendorName || '-'}</td>
                      <td className={cn('px-4 py-3')}>{item.blogName || '-'}</td>
                      <td className={cn('px-4 py-3')}>{item.postTitle || '-'}</td>
                      <td className={cn('px-4 py-3')}>
                        {item.postLink ? (
                          <a
                            className={cn('text-[var(--accent-1)]')}
                            href={item.postLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {processed.length === 0 ? (
                <div className={cn('px-5 py-6 text-sm text-[var(--ink-2)]')}>
                  No batch data returned yet.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
};
