import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, ListChecks, Search, Sparkles } from 'lucide-react';
import { cn, Badge, Button, Card, Input, Label, Toggle } from '@/shared';
import { requestTestKeyword } from '@/features/test-keyword/api/test-keyword.api';
import { useApiBase } from '@/shared/hooks/use-api-base';

export const TestPanel = () => {
  const { normalizedBase } = useApiBase();
  const [keyword, setKeyword] = React.useState('');
  const [allowAnyBlog, setAllowAnyBlog] = React.useState(false);
  const [fetchHtml, setFetchHtml] = React.useState(false);
  const [maxContentChecks, setMaxContentChecks] = React.useState(10);
  const [contentCheckDelay, setContentCheckDelay] = React.useState(300);

  const mutation = useMutation({
    mutationFn: () =>
      requestTestKeyword(normalizedBase, {
        keyword,
        allowAnyBlog,
        fetchHtml,
        maxContentChecks: fetchHtml ? maxContentChecks : undefined,
        contentCheckDelay: fetchHtml ? contentCheckDelay : undefined,
      }),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    mutation.mutate();
  };

  const result = mutation.data;
  const matches = result?.matches ?? [];

  return (
    <Card className={cn('p-8')}> 
      <div className={cn('flex flex-col gap-6')}>
        <div className={cn('flex items-center justify-between')}>
          <div className={cn('flex items-center gap-3')}>
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--accent-1)]'
              )}
            >
              <Search size={18} />
            </div>
            <div>
              <h2 className={cn('text-lg font-semibold text-[var(--ink-1)]')}>
                Keyword Test
              </h2>
              <p className={cn('text-sm text-[var(--ink-2)]')}>
                Validate exposure and vendor matching for a single keyword.
              </p>
            </div>
          </div>
          <Badge variant={result?.ok ? 'success' : 'neutral'}>
            {result?.ok ? 'Matches Found' : 'Awaiting Run'}
          </Badge>
        </div>

        <form
          onSubmit={handleSubmit}
          className={cn('grid gap-5 rounded-3xl border border-[var(--border)] bg-white/60 p-6')}
        >
          <div className={cn('grid gap-2')}>
            <Label
              htmlFor="keyword"
              hint="Use keyword or keyword(target) to apply vendor filtering."
            >
              Keyword
            </Label>
            <Input
              id="keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="e.g. Gangnam Cafe (Example Brand)"
              startIcon={<Sparkles size={16} />}
            />
          </div>

          <div className={cn('grid gap-3 md:grid-cols-2')}>
            <Toggle
              label="Allow any blog"
              description="Skip blog whitelist filtering."
              checked={allowAnyBlog}
              onChange={(event) => setAllowAnyBlog(event.target.checked)}
            />
            <Toggle
              label="Fetch post HTML"
              description="Extract vendor names from post content."
              checked={fetchHtml}
              onChange={(event) => setFetchHtml(event.target.checked)}
            />
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
                disabled={!fetchHtml}
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
                disabled={!fetchHtml}
              />
            </div>
          </div>

          <div className={cn('flex flex-wrap items-center gap-3')}> 
            <Button type="submit" isLoading={mutation.isPending}>
              Run Test
            </Button>
            <span className={cn('text-xs text-[var(--ink-2)]')}>
              Current matches: {matches.length}
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
          <div className={cn('grid gap-4')}> 
            <div className={cn('grid gap-2 md:grid-cols-3')}>
              <div
                className={cn(
                  'rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm'
                )}
              >
                <span className={cn('text-xs text-[var(--ink-2)]')}>Query</span>
                <div className={cn('mt-1 font-semibold text-[var(--ink-1)]')}>
                  {result.query || '-'}
                </div>
              </div>
              <div
                className={cn(
                  'rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm'
                )}
              >
                <span className={cn('text-xs text-[var(--ink-2)]')}>Base keyword</span>
                <div className={cn('mt-1 font-semibold text-[var(--ink-1)]')}>
                  {result.baseKeyword || '-'}
                </div>
              </div>
              <div
                className={cn(
                  'rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm'
                )}
              >
                <span className={cn('text-xs text-[var(--ink-2)]')}>Restaurant</span>
                <div className={cn('mt-1 font-semibold text-[var(--ink-1)]')}>
                  {result.restaurantName || '-'}
                </div>
              </div>
            </div>

            <div className={cn('overflow-hidden rounded-3xl border border-[var(--border)]')}>
              <div
                className={cn(
                  'flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4'
                )}
              >
                <div className={cn('flex items-center gap-2 text-sm font-semibold')}>
                  <ListChecks size={16} />
                  Match List
                </div>
                <Badge variant={result.ok ? 'success' : 'danger'}>
                  {result.ok ? 'Pass' : 'Fail'}
                </Badge>
              </div>
              <div className={cn('max-h-[320px] overflow-auto')}> 
                <table className={cn('w-full text-left text-sm')}> 
                  <thead className={cn('bg-white/60 text-xs text-[var(--ink-2)]')}>
                    <tr>
                      <th className={cn('px-4 py-3')}>#</th>
                      <th className={cn('px-4 py-3')}>Topic</th>
                      <th className={cn('px-4 py-3')}>Rank</th>
                      <th className={cn('px-4 py-3')}>Blog</th>
                      <th className={cn('px-4 py-3')}>Title</th>
                      <th className={cn('px-4 py-3')}>Vendor</th>
                      <th className={cn('px-4 py-3')}>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(({ match, postVendorName }, index) => (
                      <tr
                        key={`${match.postLink}-${index}`}
                        className={cn('border-t border-[var(--border)]')}
                      >
                        <td className={cn('px-4 py-3 text-[var(--ink-2)]')}>
                          {index + 1}
                        </td>
                        <td className={cn('px-4 py-3')}>{match.topicName}</td>
                        <td className={cn('px-4 py-3')}>{match.position}</td>
                        <td className={cn('px-4 py-3')}>{match.blogName}</td>
                        <td className={cn('px-4 py-3')}>{match.postTitle}</td>
                        <td className={cn('px-4 py-3')}>{postVendorName || '-'}</td>
                        <td className={cn('px-4 py-3')}>
                          <a
                            className={cn('inline-flex items-center gap-1 text-[var(--accent-1)]')}
                            href={match.postLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                            <ArrowRight size={14} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {matches.length === 0 ? (
                  <div className={cn('px-5 py-6 text-sm text-[var(--ink-2)]')}>
                    No matches returned. Adjust filters or retry.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
};
