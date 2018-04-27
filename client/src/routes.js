const LoginRoute = () => import('./features/Auth/Login.vue');
const RegisterRoute = () => import('./features/Auth/Register.vue');
const MainRoute = () => import('./features/Main/Main.vue');
const DashboardRoute = () => import('./features/Main/Dashboard/Dashboard.vue');
const TestRoute = () => import('./features/Main/Test/Test.vue');
const ClientsRoute = () => import('./features/Main/CRUDs/Clients/Clients.vue');
const RequestsRoute = () => import('./features/Main/CRUDs/Requests/Requests.vue');
const CompaniesRoute = () => import('./features/Main/Companies/Companies.vue');

export default [
    {
        path: '/login',
        component: LoginRoute,
        meta: {
            title: 'Login - Agiliza ERP'
        }
    },
    {
        path: '/register',
        component: RegisterRoute,
        meta: {
            title: 'Criar nova conta - Agiliza ERP'
        }
    },
    {
        path: '/',
        component: MainRoute,
        children: [
            {
                path: 'dashboard',
                name: 'dashboard',
                component: DashboardRoute,
                meta: {
                    title: 'Painel de pedidos - Agiliza ERP'
                }
            },
            {
                path: 'clients',
                component: ClientsRoute,
                meta: {
                    title: 'Clientes - Agiliza ERP'
                }
            },
            {
                path: 'test',
                component: TestRoute,
                meta: {
                    title: 'Testes - Agiliza ERP'
                }
            },
            {
                path: 'requests',
                component: RequestsRoute,
                meta: {
                    title: 'Atendimentos - Agiliza ERP'
                }
            },
            {
                path: 'companies',
                component: CompaniesRoute,
                meta: {
                    title: 'Empresas - Agiliza ERP'
                }
            },
            {
                path: '*',
                redirect: '/dashboard'
            }
        ]
    },
    {
        path: '*',
        redirect: '/dashboard'
    }
]
