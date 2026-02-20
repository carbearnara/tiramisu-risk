'use client';

import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldAlert,
  Lock,
  MousePointerClick,
  Coins,
  Layers,
  Globe,
  ExternalLink,
  Info,
} from 'lucide-react';

const categoryIcons: Record<RiskCategory, React.ReactNode> = {
  [RiskCategory.CUSTODY]: <Lock className="w-4 h-4" />,
  [RiskCategory.TRANSACTION]: <MousePointerClick className="w-4 h-4" />,
  [RiskCategory.PROTOCOL]: <ShieldAlert className="w-4 h-4" />,
  [RiskCategory.DIGITAL_ASSET]: <Coins className="w-4 h-4" />,
  [RiskCategory.STAKING]: <Layers className="w-4 h-4" />,
  [RiskCategory.SYSTEMIC]: <Globe className="w-4 h-4" />,
};

const categoryLabels: Record<RiskCategory, string> = {
  [RiskCategory.CUSTODY]: 'Custody',
  [RiskCategory.TRANSACTION]: 'Transaction',
  [RiskCategory.PROTOCOL]: 'Protocol',
  [RiskCategory.DIGITAL_ASSET]: 'Digital Asset',
  [RiskCategory.STAKING]: 'Staking',
  [RiskCategory.SYSTEMIC]: 'Systemic',
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
  const [activeTab, setActiveTab] = useState('overview');

  if (!selectedNodeId || !graph) {
    return (
      <div className="p-6 text-center text-gray-500 h-full flex items-center justify-center">
        <div>
          <Info className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Select a node to view details</p>
        </div>
      </div>
    );
  }

  const entity = graph.entities.get(selectedNodeId);
  const assessment = assessments.get(selectedNodeId);

  if (!entity) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="text-sm">Entity not found</p>
      </div>
    );
  }

  // Get top 3 risk factors
  const topFactors = assessment?.categoryScores
    .flatMap(cs => cs.factors)
    .filter(f => !f.sourceEntityId) // Direct factors only
    .sort((a, b) => a.score - b.score) // Lower score = higher risk
    .slice(0, 3) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          {entity.metadata.logo && (
            <img
              src={entity.metadata.logo as string}
              alt={entity.name}
              className="w-8 h-8 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">{entity.name}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-xs">
                {entity.type.replace('_', ' ')}
              </Badge>
              {entity.chain && (
                <span className="text-xs text-gray-500 capitalize">{entity.chain}</span>
              )}
            </div>
          </div>
        </div>

        {/* Overall Risk Score */}
        {assessment && (
          <div className="flex items-center gap-3 mt-3">
            <Progress value={assessment.overallScore} className="h-2 flex-1" />
            <span
              className="text-lg font-bold min-w-[2.5rem] text-right"
              style={{ color: riskLevelToColor(assessment.overallLevel) }}
            >
              {Math.round(assessment.overallScore)}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 grid grid-cols-3">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="risks" className="text-xs">Risks</TabsTrigger>
          <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          {/* Overview Tab */}
          <TabsContent value="overview" className="p-4 space-y-4 mt-0">
            {/* Risk Level Badge */}
            {assessment && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Risk Level</span>
                <Badge
                  variant={riskLevelBadgeVariants[assessment.overallLevel]}
                  className="capitalize"
                >
                  {assessment.overallLevel}
                </Badge>
              </div>
            )}

            {/* Top Risk Factors */}
            {topFactors.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">Top Risk Factors</h3>
                <div className="space-y-2">
                  {topFactors.map((factor) => (
                    <div
                      key={factor.id}
                      className="p-2 bg-gray-50 rounded text-sm"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">{factor.name}</span>
                        <span className="text-xs text-gray-500">{Math.round(factor.score)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{factor.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inherited Risks Summary */}
            {assessment && assessment.aggregatedRisks.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">
                  Inherited Risks ({assessment.aggregatedRisks.length})
                </h3>
                <p className="text-xs text-gray-400">
                  Risks from dependencies. View Risks tab for details.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Risks Tab */}
          <TabsContent value="risks" className="p-4 mt-0">
            {assessment ? (
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
                          className="mr-2 text-xs"
                        >
                          {Math.round(cs.score)}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {cs.factors.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">
                            No risk factors
                          </p>
                        ) : (
                          cs.factors.map((factor) => (
                            <div
                              key={factor.id}
                              className={`p-2 rounded text-sm ${
                                factor.sourceEntityId ? 'bg-gray-50' : 'bg-white border'
                              }`}
                            >
                              <div className="flex justify-between text-xs">
                                <span className="font-medium">{factor.name}</span>
                                <span className="text-gray-500">
                                  {Math.round(factor.score)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {factor.description}
                              </p>
                              {factor.sourceEntityId && (
                                <p className="text-xs text-blue-500 mt-1">
                                  From: {factor.sourceEntityId}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}

                {/* Inherited Risks - Collapsed by default */}
                {assessment.aggregatedRisks.length > 0 && (
                  <AccordionItem value="inherited">
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-gray-500">
                          <ExternalLink className="w-4 h-4" />
                        </span>
                        <span className="flex-1 text-left text-sm">
                          Inherited Risks
                        </span>
                        <Badge variant="outline" className="mr-2 text-xs">
                          {assessment.aggregatedRisks.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {assessment.aggregatedRisks.slice(0, 10).map((risk, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-gray-50 rounded text-xs"
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">{risk.factor.name}</span>
                              <span className="text-gray-500">
                                {Math.round(risk.factor.score)}
                              </span>
                            </div>
                            <div className="text-gray-400 mt-1">
                              From: {risk.sourceEntityId}
                            </div>
                            <div className="text-gray-400">
                              Dilution: {(risk.dilutionFactor * 100).toFixed(0)}%
                            </div>
                          </div>
                        ))}
                        {assessment.aggregatedRisks.length > 10 && (
                          <p className="text-xs text-gray-400 text-center">
                            + {assessment.aggregatedRisks.length - 10} more
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            ) : (
              <p className="text-sm text-gray-400">No risk data available</p>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="p-4 mt-0">
            <dl className="space-y-3 text-sm">
              {entity.address && (
                <div>
                  <dt className="text-xs text-gray-500 mb-1">Address</dt>
                  <dd className="font-mono text-xs break-all">
                    {entity.address}
                  </dd>
                </div>
              )}
              {entity.metadata.website && (
                <div>
                  <dt className="text-xs text-gray-500 mb-1">Website</dt>
                  <dd>
                    <a
                      href={entity.metadata.website as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-xs flex items-center gap-1"
                    >
                      {entity.metadata.website as string}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </dd>
                </div>
              )}
              {entity.metadata.twitter && (
                <div>
                  <dt className="text-xs text-gray-500 mb-1">Twitter</dt>
                  <dd>
                    <a
                      href={`https://twitter.com/${entity.metadata.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-xs"
                    >
                      @{entity.metadata.twitter as string}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 mb-1">Entity ID</dt>
                <dd className="font-mono text-xs break-all text-gray-600">
                  {entity.id}
                </dd>
              </div>
            </dl>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
