import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'jacket',
      component: () => import('../views/JacketView.vue'),
    },
    {
      path: '/guitar',
      name: 'guitar',
      // route level code-splitting
      // this generates a separate chunk (Guitaer.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/GuitarView.vue'),
    },
  ],
})

export default router
