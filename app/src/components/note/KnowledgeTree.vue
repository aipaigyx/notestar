<template>
  <div class="knowledge-tree">
    <div class="tree-node root">
      <span class="tree-label">{{ tree.title }}</span>
    </div>
    <div class="tree-children">
      <div v-for="(child, ci) in tree.children" :key="ci" class="tree-branch">
        <div class="tree-line"></div>
        <div class="tree-node level-1">
          <span class="tree-label">{{ child.title }}</span>
        </div>
        <div class="tree-children" v-if="child.children?.length">
          <div v-for="(gc, gi) in child.children" :key="gi" class="tree-branch">
            <div class="tree-line"></div>
            <div class="tree-node level-2">
              <span class="tree-label">{{ gc.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { KnowledgeTreeNode } from '../../types'

defineProps<{
  tree: KnowledgeTreeNode
}>()
</script>

<style scoped>
.knowledge-tree { display: flex; flex-direction: column; gap: 6px; }
.tree-node { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: var(--radius-pill); font-size: 12px; font-weight: 600; }
.tree-node.root { background: var(--gradient-pink-purple); color: #fff; box-shadow: 0 2px 8px rgba(255,107,157,0.25); }
.tree-node.level-1 { background: var(--color-pink-light); color: var(--color-pink); }
.tree-node.level-2 { background: var(--color-purple-light); color: var(--color-purple); }
.tree-label { line-height: 1.5; }
.tree-children { display: flex; flex-direction: column; gap: 4px; padding-left: 14px; }
.tree-branch { display: flex; flex-direction: column; gap: 4px; position: relative; }
.tree-line { width: 2px; height: 100%; min-height: 14px; background: linear-gradient(180deg, rgba(255,107,157,0.4), rgba(183,148,246,0.3)); border-radius: 1px; margin-left: 4px; }
</style>
