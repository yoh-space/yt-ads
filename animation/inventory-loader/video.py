from manim import *


class InventoryLoader(Scene):
    def construct(self):
        # Target: 4.8s, silent loop-friendly loading component.
        navy = "#002E4B"
        navy_soft = "#0A4565"
        cyan = "#19C4D2"
        cyan_soft = "#8CECF1"
        gold = "#E2AD3C"
        violet = "#8874DC"
        white = "#F6FBFC"
        muted = "#86AEBB"

        self.camera.background_color = navy

        grid = VGroup()
        for x in np.arange(-7.0, 7.1, 1.0):
            grid.add(Line(UP * 4.0 + RIGHT * x, DOWN * 4.0 + RIGHT * x, stroke_width=0.45, color=navy_soft))
        for y in np.arange(-4.0, 4.1, 1.0):
            grid.add(Line(LEFT * 7.1 + UP * y, RIGHT * 7.1 + UP * y, stroke_width=0.45, color=navy_soft))
        grid.set_opacity(0.48)

        header = VGroup(
            Text("YT ADVERTISEMENT", font="DejaVu Sans", font_size=24, weight=BOLD, color=white),
            Text("INVENTORY MANAGEMENT SYSTEM", font="DejaVu Sans", font_size=10, color=muted, t2c={"INVENTORY": cyan_soft}),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.08).to_edge(UP, buff=0.55).to_edge(LEFT, buff=0.72)

        brand_box = RoundedRectangle(width=1.58, height=1.58, corner_radius=0.2, stroke_color=cyan, stroke_width=2.0, fill_color=navy_soft, fill_opacity=0.9)
        brand_y = Text("Y", font="DejaVu Sans", font_size=45, weight=BOLD, color=white)
        brand_y.move_to(brand_box.get_center())
        brand_accent = Square(side_length=0.22, color=gold, fill_color=gold, fill_opacity=1, stroke_width=0).rotate(PI / 4)
        brand_accent.move_to(brand_box.get_corner(DR) + LEFT * 0.06 + UP * 0.06)
        brand_mark = VGroup(brand_box, brand_y, brand_accent)

        ring = Circle(radius=1.24, color=cyan, stroke_width=3.0).set_opacity(0.18)
        sync_arc = Arc(radius=1.24, start_angle=-PI / 2, angle=PI * 1.28, color=cyan_soft, stroke_width=6.0)
        ring_center = VGroup(ring, sync_arc).move_to(ORIGIN + UP * 0.25)
        mark = brand_mark.move_to(ring_center.get_center())
        central_label = Text("CONNECTING", font="DejaVu Sans", font_size=11, weight=BOLD, color=cyan_soft)
        central_label.next_to(ring_center, DOWN, buff=0.36)
        central_sub = Text("materials  ·  machines  ·  jobs", font="DejaVu Sans", font_size=9, color=muted)
        central_sub.next_to(central_label, DOWN, buff=0.1)

        card_specs = [
            ("MATERIALS", "6 tracked items", cyan, "01"),
            ("MACHINES", "4 production units", gold, "02"),
            ("JOB CARDS", "live queue sync", violet, "03"),
        ]
        cards = VGroup()
        for title, detail, accent, code in card_specs:
            card = RoundedRectangle(width=3.08, height=0.78, corner_radius=0.12, stroke_color=accent, stroke_width=1.2, fill_color=navy_soft, fill_opacity=0.72)
            code_text = Text(code, font="DejaVu Sans", font_size=10, weight=BOLD, color=accent).move_to(card.get_left() + RIGHT * 0.26)
            title_text = Text(title, font="DejaVu Sans", font_size=11, weight=BOLD, color=white)
            title_text.move_to(card.get_left() + RIGHT * 0.67 + UP * 0.13)
            detail_text = Text(detail, font="DejaVu Sans", font_size=8, color=muted)
            detail_text.move_to(card.get_left() + RIGHT * 0.67 + DOWN * 0.16)
            cards.add(VGroup(card, code_text, title_text, detail_text))
        cards.arrange(RIGHT, buff=0.18).to_edge(DOWN, buff=1.18)

        rail = VGroup(*[
            RoundedRectangle(width=1.46, height=0.08, corner_radius=0.04, stroke_width=0, fill_color=muted, fill_opacity=0.32)
            for _ in range(6)
        ]).arrange(RIGHT, buff=0.1).next_to(cards, DOWN, buff=0.38)
        rail.set_width(5.4)
        rail.move_to(DOWN * 2.62)
        rail_lit = VGroup(*[
            RoundedRectangle(width=1.46, height=0.08, corner_radius=0.04, stroke_width=0, fill_color=cyan, fill_opacity=1)
            for _ in range(6)
        ]).arrange(RIGHT, buff=0.1)
        rail_lit.set_width(5.4).move_to(rail)
        rail_lit.set_opacity(0)

        status = Text("SECURE SYNC  /  REAL-TIME OPERATIONS", font="DejaVu Sans", font_size=9, color=muted)
        status.next_to(rail, DOWN, buff=0.26)

        self.add(grid)
        self.play(FadeIn(header, shift=DOWN * 0.12), run_time=0.55)
        self.play(FadeIn(ring_center), FadeIn(mark, scale=0.82), run_time=0.7)
        self.play(FadeIn(central_label, shift=UP * 0.08), FadeIn(central_sub, shift=UP * 0.08), run_time=0.35)
        self.play(LaggedStart(*[FadeIn(card, shift=UP * 0.12) for card in cards], lag_ratio=0.13), run_time=0.85)
        self.play(FadeIn(rail), FadeIn(status, shift=UP * 0.08), run_time=0.28)
        self.play(
            Rotate(sync_arc, angle=TAU, about_point=ring_center.get_center(), rate_func=linear),
            FadeIn(rail_lit),
            central_label.animate.set_color(white),
            run_time=1.45,
        )
        self.play(
            FadeOut(central_label),
            FadeOut(central_sub),
            FadeIn(Text("READY", font="DejaVu Sans", font_size=12, weight=BOLD, color=cyan_soft).move_to(central_label)),
            run_time=0.22,
        )
        self.wait(0.3)
