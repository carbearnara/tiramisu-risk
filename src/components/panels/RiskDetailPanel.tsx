'use client';

import { useGraphStore } from '@/stores/graph-store';
import {
  RiskCategory,
  RiskLevel,
  riskLevelToColor,
} from '@/types/core';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldAlert,
  Users,
  Radio,
  Vote,
  Droplets,
  Lock,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

const categoryIcons: Record<RiskCategory, React.ReactNode> = {
  [RiskCategory.SMART_CONTRACT]: <ShieldAlert className="w-4 h-4" />,
  [RiskCategory.COUNTERPARTY]: <Users className="w-4 h-4" />,
  [RiskCategory.ORACLE]: <Radio className="w-4 h-4" />,
  [RiskCategory.GOVERNANCE]: <Vote className="w-4 h-4" />,
  [RiskCategory.LIQUIDITY]: <Droplets className="w-4 h-4" />,
  [RiskCategory.CUSTODY]: <Lock className="w-4 h-4" />,
};

const categoryLabels: Record<RiskCategory, string> = {
  [RiskCategory.SMART_CONTRACT]: 'Smart Contract',
  [RiskCategory.COUNTERPARTY]: 'Counterparty',
  [RiskCategory.ORACLE]: 'Oracle',
  [RiskCategory.GOVERNANCE]: 'Governance',
  [RiskCategory.LIQUIDITY]: 'Liquidity',
  [RiskCategory.CUSTODY]: 'Custody',
};

const riskLevelBadgeVariants: Record<RiskLevel, 'destructive' | 'secondary' | 'outline'> = {
  [RiskLevel.CRITICAL]: 'destructive',
  [RiskLevel.HIGH]: 'destructive',
  [RiskLevel.MEDIUM]: 'secondary',
  [RiskLevel.LOW]: 'outline',
  [RiskLevel.MINIMAL]: 'outline',
};

export function RiskDetailPanel() {
  const { selectedNodeId, graph, assessments } = useGraphStore();

  if (!selectedNodeId || !graph) {
    return (
      <div className="p-6 text-center text-gray-500 h-full flex items-center justify-center">
        <div>
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>Select a node to view risk details</p>
        </div>
      </div>
    );
  }

  const entity = graph.entities.get(selectedNodeId);
  const assessment = assessments.get(selectedNodeId);

  if (!entity) {
    return (
      <div className="p-6 text-center text-gray-500">
        Entity not found
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Entity Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {entity.metadata.logo && (
              <img
                src={entity.metadata.logo as string}
                alt={entity.name}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{entity.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize">
                  {entity.type.replace('_', ' ')}
                </Badge>
                {entity.chain && (
                  <Badge variant="secondary" className="capitalize">
                    {entity.chain}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        {assessment && (
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Risk Score</span>
              <span
                className="text-2xl font-bold"
                style={{ color: riskLevelToColor(assessment.overallLevel) }}
              >
                {Math.round(assessment.overallScore)}
              </span>
            </div>
            <Progress
              value={assessment.overallScore}
              className="h-3"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">Higher = Safer</span>
              <Badge
                variant={riskLevelBadgeVariants[assessment.overallLevel]}
                className="capitalize"
              >
                {assessment.overallLevel}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Risk Categories Breakdown */}
      {assessment && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risk Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion type="multiple" className="w-full">
              {assessment.categoryScores.map((cs) => (
                <AccordionItem key={cs.category} value={cs.category}>
                  <AccordionTrigger className="hover:no-underline py-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-gray-500">
                        {categoryIcons[cs.category]}
                      </span>
                      <span className="flex-1 text-left text-sm">
                        {categoryLabels[cs.category]}
                      </span>
                      <Badge
                        variant={riskLevelBadgeVariants[cs.level]}
                        className="mr-2 tabular-nums"
                      >
                        {Math.round(cs.score)}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {cs.factors.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">
                          No risk factors identified
                        </p>
                      ) : (
                        cs.factors.map((factor) => (
                          <div
                            key={factor.id}
                            className="space-y-1 border-l-2 pl-3"
                            style={{
                              borderColor: factor.sourceEntityId
                                ? '#94A3B8'
                                : riskLevelToColor(
                                    assessment.overallLevel
                                  ),
                            }}
                          >
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{factor.name}</span>
                              <span
                                className="tabular-nums"
                                style={{
                                  color: riskLevelToColor(
                                    assessment.overallLevel
                                  ),
                                }}
                              >
                                {Math.round(factor.score)}
                              </span>
                            </div>
                            <Progress value={factor.score} className="h-1.5" />
                            <p className="text-xs text-gray-500">
                              {factor.description}
                            </p>
                            {factor.sourceEntityId && (
                              <p className="text-xs text-blue-500">
                                Inherited from: {factor.sourceEntityId}
                              </p>
                            )}
                            {factor.evidence.length > 0 && (
                              <div className="mt-1">
                                {factor.evidence.slice(0, 2).map((ev, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[10px] text-gray-400 flex items-center gap-1"
                                  >
                                    <span className="capitalize">{ev.type}:</span>
                                    <span className="truncate">
                                      {String(ev.value).slice(0, 50)}
                                    </span>
                                    {ev.url && (
                                      <a
                                        href={ev.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-600"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Aggregated/Inherited Risks */}
      {assessment && assessment.aggregatedRisks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Inherited Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-gray-500 mb-3">
              Risks propagated from dependencies (diluted by exposure)
            </p>
            <div className="space-y-2">
              {assessment.aggregatedRisks.slice(0, 5).map((risk, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-gray-50 rounded text-sm border-l-2 border-orange-300"
                >
                  <div className="flex justify-between">
                    <span className="font-medium text-xs">
                      {risk.factor.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(risk.factor.score)}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Source: {risk.sourceEntityId}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Dilution: {(risk.dilutionFactor * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
              {assessment.aggregatedRisks.length > 5 && (
                <p className="text-xs text-gray-400 text-center">
                  + {assessment.aggregatedRisks.length - 5} more inherited risks
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Metadata */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="space-y-1 text-sm">
            {entity.address && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Address</dt>
                <dd className="font-mono text-xs truncate max-w-[180px]">
                  {entity.address}
                </dd>
              </div>
            )}
            {entity.metadata.website && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Website</dt>
                <dd>
                  <a
                    href={entity.metadata.website as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1"
                  >
                    Visit <ExternalLink className="w-3 h-3" />
                  </a>
                </dd>
              </div>
            )}
            {entity.metadata.twitter && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Twitter</dt>
                <dd>
                  <a
                    href={`https://twitter.com/${entity.metadata.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    @{entity.metadata.twitter as string}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
