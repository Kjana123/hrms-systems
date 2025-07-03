--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9

-- Started on 2025-06-21 09:29:30

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: hrms_db_1n1z_user
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 3407 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: hrms_db_1n1z_user
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 16410)
-- Name: attendance; Type: TABLE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    user_id integer,
    date date,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    status text
);


ALTER TABLE public.attendance OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 217 (class 1259 OID 16409)
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_id_seq OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 3408 (class 0 OID 0)
-- Dependencies: 217
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- TOC entry 220 (class 1259 OID 16424)
-- Name: corrections; Type: TABLE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE TABLE public.corrections (
    id integer NOT NULL,
    user_id integer,
    date date,
    reason text,
    status text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.corrections OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 219 (class 1259 OID 16423)
-- Name: corrections_id_seq; Type: SEQUENCE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE SEQUENCE public.corrections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corrections_id_seq OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 3409 (class 0 OID 0)
-- Dependencies: 219
-- Name: corrections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER SEQUENCE public.corrections_id_seq OWNED BY public.corrections.id;


--
-- TOC entry 222 (class 1259 OID 16438)
-- Name: leaves; Type: TABLE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE TABLE public.leaves (
    id integer NOT NULL,
    user_id integer,
    from_date date,
    to_date date,
    reason text,
    status text
);


ALTER TABLE public.leaves OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 221 (class 1259 OID 16437)
-- Name: leaves_id_seq; Type: SEQUENCE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE SEQUENCE public.leaves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leaves_id_seq OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 3410 (class 0 OID 0)
-- Dependencies: 221
-- Name: leaves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER SEQUENCE public.leaves_id_seq OWNED BY public.leaves.id;


--
-- TOC entry 223 (class 1259 OID 16457)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE TABLE public.password_reset_tokens (
    user_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 216 (class 1259 OID 16399)
-- Name: users; Type: TABLE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text,
    role text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'employee'::text])))
);


ALTER TABLE public.users OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 215 (class 1259 OID 16398)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: hrms_db_1n1z_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO hrms_db_1n1z_user;

--
-- TOC entry 3411 (class 0 OID 0)
-- Dependencies: 215
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3227 (class 2604 OID 16413)
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- TOC entry 3228 (class 2604 OID 16427)
-- Name: corrections id; Type: DEFAULT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.corrections ALTER COLUMN id SET DEFAULT nextval('public.corrections_id_seq'::regclass);


--
-- TOC entry 3230 (class 2604 OID 16441)
-- Name: leaves id; Type: DEFAULT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.leaves ALTER COLUMN id SET DEFAULT nextval('public.leaves_id_seq'::regclass);


--
-- TOC entry 3226 (class 2604 OID 16402)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3396 (class 0 OID 16410)
-- Dependencies: 218
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: hrms_db_1n1z_user
--

COPY public.attendance (id, user_id, date, check_in, check_out, status) FROM stdin;
1	1	2025-06-21	2025-06-21 12:39:45.923914	\N	\N
3	15	2025-06-21	2025-06-21 13:14:57.946376	\N	\N
4	15	2025-06-20	\N	\N	present
5	17	2025-06-21	2025-06-21 13:22:45.026363	\N	\N
\.


--
-- TOC entry 3398 (class 0 OID 16424)
-- Dependencies: 220
-- Data for Name: corrections; Type: TABLE DATA; Schema: public; Owner: hrms_db_1n1z_user
--

COPY public.corrections (id, user_id, date, reason, status, created_at) FROM stdin;
1	15	2025-06-20	Forgot to punch	approved	2025-06-21 13:16:43.817288
\.


--
-- TOC entry 3400 (class 0 OID 16438)
-- Dependencies: 222
-- Data for Name: leaves; Type: TABLE DATA; Schema: public; Owner: hrms_db_1n1z_user
--

COPY public.leaves (id, user_id, from_date, to_date, reason, status) FROM stdin;
\.


--
-- TOC entry 3401 (class 0 OID 16457)
-- Dependencies: 223
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: hrms_db_1n1z_user
--

COPY public.password_reset_tokens (user_id, token, expires_at) FROM stdin;
\.


--
-- TOC entry 3394 (class 0 OID 16399)
-- Dependencies: 216
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: hrms_db_1n1z_user
--

COPY public.users (id, email, password, name, role) FROM stdin;
15	manisha@example.com	$2b$10$1qiJ5qnW/9t5e79RjfPq2e3FZxt7.ji5BDGfVbd.Ken49HKN2QZyy	manisha	employee
17	saatvik@example.com	$2b$10$3niTEYWWltn1mPU1uQXGy./l7QUTC4l5CXvD09.YN3wqrRbDAkFU.	Saatvik	employee
18	dipayan@unitedsolutionsplus.in	$2b$10$LP0pA1jwqFf9Zt9InVEYTuARHiqpR7/A.jsmXsDp8GF.7CEYkw/G.	Dipayan	admin
1	test@example.com	$2b$10$eAScQSdf/WEwxscRjtowFehMo9ltFmP4xTdraFtFQnveaP4UWJSCa	Test User	\N
16	krishna@example.com	$2b$10$dIzrf7YDK7EkofX0FcdHGOHTJET4I.kFLVL6Ydc5ue5wHQ.DmXf7e	kmj	admin
\.


--
-- TOC entry 3412 (class 0 OID 0)
-- Dependencies: 217
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrms_db_1n1z_user
--

SELECT pg_catalog.setval('public.attendance_id_seq', 6, true);


--
-- TOC entry 3413 (class 0 OID 0)
-- Dependencies: 219
-- Name: corrections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrms_db_1n1z_user
--

SELECT pg_catalog.setval('public.corrections_id_seq', 1, true);


--
-- TOC entry 3414 (class 0 OID 0)
-- Dependencies: 221
-- Name: leaves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrms_db_1n1z_user
--

SELECT pg_catalog.setval('public.leaves_id_seq', 1, false);


--
-- TOC entry 3415 (class 0 OID 0)
-- Dependencies: 215
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrms_db_1n1z_user
--

SELECT pg_catalog.setval('public.users_id_seq', 22, true);


--
-- TOC entry 3237 (class 2606 OID 16417)
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- TOC entry 3241 (class 2606 OID 16431)
-- Name: corrections corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_pkey PRIMARY KEY (id);


--
-- TOC entry 3243 (class 2606 OID 16445)
-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);


--
-- TOC entry 3245 (class 2606 OID 16463)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3239 (class 2606 OID 16452)
-- Name: attendance unique_user_date; Type: CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);


--
-- TOC entry 3233 (class 2606 OID 16408)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3235 (class 2606 OID 16406)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3246 (class 2606 OID 16418)
-- Name: attendance attendance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3247 (class 2606 OID 16432)
-- Name: corrections corrections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3248 (class 2606 OID 16446)
-- Name: leaves leaves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3249 (class 2606 OID 16464)
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrms_db_1n1z_user
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


-- Completed on 2025-06-21 09:29:58

--
-- PostgreSQL database dump complete
--

