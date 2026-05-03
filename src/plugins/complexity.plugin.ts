import { Logger } from '@nestjs/common';
import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { GraphQLSchema } from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';

const MAXIMUM_COMPLEXITY = 200;
const logger = new Logger('QueryComplexity');

export function complexityPlugin(
  getSchema: () => GraphQLSchema,
): ApolloServerPlugin {
  return {
    async requestDidStart(): Promise<GraphQLRequestListener<any>> {
      const schema = getSchema();
      return {
        async didResolveOperation(requestContext) {
          const { request, document } = requestContext;

          const complexity = getComplexity({
            schema,
            query: document,
            variables: request.variables ?? {},
            estimators: [
              fieldExtensionsEstimator(),
              simpleEstimator({ defaultComplexity: 1 }),
            ],
          });

          logger.debug(`Query complexity: ${complexity}`);

          if (complexity > MAXIMUM_COMPLEXITY) {
            throw new Error(
              `Query too complex: ${complexity}. Maximum allowed complexity: ${MAXIMUM_COMPLEXITY}.`,
            );
          }
        },
      };
    },
  };
}
